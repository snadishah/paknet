// The whole network under generated traffic, headless.
import { describe, it, expect, beforeEach } from 'vitest';
import { buildTopology } from '../src/graph/topology.js';
import { createNetwork } from '../src/sim/network.js';
import { createTraffic, edgeCapacityGbps } from '../src/sim/traffic.js';
import { state } from '../src/state.js';
import { TIME_SCALE_MS } from '../src/sim/params.js';

const quiet = { drop() {}, arrive() {} };
// Run `ms` of network time in wall-clock-sized steps.
function runFor(traffic, ms) { const step = 1 / 60; for (let t = 0; t < ms; t += step * TIME_SCALE_MS) traffic.advance(step, quiet); }

describe('traffic on the full network', () => {
  let G, net, traffic;
  beforeEach(() => {
    G = buildTopology(); net = createNetwork(G); traffic = createTraffic(G, net);
    Object.assign(state, { simHour: 21, plannedActive: false, convergeUntil: 0, staleSet: new Set() });
  });

  it('capacity KPI is the sum of the live cables plus the China fibre', () => {
    expect(traffic.intlCapacityTbps()).toBeCloseTo((3580 + 1980 + 1900 + 2600 + 800 + 1700 + 4000 + 450) / 1000, 3);
  });

  it('at the evening peak, carries most international demand with little loss', () => {
    runFor(traffic, 60); traffic.sample(); // warm up
    runFor(traffic, 60); const m = traffic.sample();
    expect(m.intlInTbps).toBeGreaterThan(m.intlOutTbps); // most international traffic is inbound
    expect(m.intlTbps).toBeGreaterThan(5);
    expect(m.intlTbps).toBeLessThan(traffic.intlCapacityTbps());
    expect(m.lossPct).toBeLessThan(2);
    expect(m.rttMs).toBeGreaterThan(10); // Karachi–Lahore–Karachi, mostly propagation
    expect(m.rttMs).toBeLessThan(60);
  });

  it('losing every Karachi cable leaves only the China fibre: throughput collapses, loss soars', () => {
    runFor(traffic, 40); traffic.sample();
    for (const c of G.CABLES) for (const e of c.edges) if (!e.cut) { net.cutEdge(e); traffic.onCut(e); }
    net.topologyChanged(G.cableEdges, 'OSPF');
    runFor(traffic, 60); traffic.sample();
    runFor(traffic, 60); const m = traffic.sample();
    expect(traffic.intlCapacityTbps()).toBeCloseTo(0.45, 3);
    expect(m.intlTbps).toBeLessThan(0.7); // the 0.45 Tbps China fibre plus the small land borders
    expect(m.lossPct).toBeGreaterThan(30);
  });

  it('the China fibre runs near full when it is the only way out', () => {
    for (const c of G.CABLES) for (const e of c.edges) { net.cutEdge(e); traffic.onCut(e); }
    net.topologyChanged(G.cableEdges, 'OSPF');
    runFor(traffic, 80); traffic.sample(); runFor(traffic, 40); traffic.sample();
    const ofc = G.adj.get(G.INTL.N.id)[0];
    expect(edgeCapacityGbps(G, ofc)).toBe(450);
    expect(ofc.util).toBeGreaterThan(0.9);
  });

  it('an 8 Tbps flood saturates a data centre uplink; diverting it to scrubbing relieves it', () => {
    const { DCS } = G, lahoreDC = DCS[1], scrub = DCS[3];
    const dcLink = G.adj.get(lahoreDC.id)[0];
    const towardDC = () => traffic.engine.links.get(dcLink.id * 2 + (dcLink.a === lahoreDC.id ? 1 : 0)); // city → DC direction
    const flood = (target, ms) => {
      const step = 1 / 60;
      for (let t = 0; t < ms; t += step * TIME_SCALE_MS) {
        for (let i = 0; i < 8 * TIME_SCALE_MS / 0.1 * step; i++) { // 8 Tbps of 0.1 Gbit bundles
          const ce = traffic.pickCableEdge();
          const p = net.route(target.id, ce.a); // target → landing station, reversed below
          traffic.emitPacket({ seq: [ce.b, ...[...p.seq].reverse()], edges: [ce, ...[...p.edges].reverse()] }, 'atk', { sink: true });
        }
        traffic.advance(step, quiet);
      }
    };
    runFor(traffic, 30); traffic.sample();
    flood(lahoreDC, 60); traffic.sample(); flood(lahoreDC, 30); const hit = traffic.sample();
    expect(towardDC().util).toBeGreaterThan(0.95);
    expect(hit.nodeQ.get(G.N('Lahore').id)).toBeGreaterThan(0.5); // Lahore's queue towards the DC is backed up
    flood(scrub, 60); traffic.sample(); flood(scrub, 30); const scrubbed = traffic.sample();
    expect(towardDC().util).toBeLessThan(0.5);
    expect(scrubbed.lossPct).toBeLessThan(hit.lossPct);
  });

  it('under RIP, a cut that triggers count-to-infinity makes traffic loop until its TTL expires', () => {
    state.protocol = 'RIP';
    try {
      const nk = G.N('Nok Kundi').id, taftan = G.N('Taftan').id;
      const e = G.adj.get(nk).find(x => x.a === taftan || x.b === taftan);
      runFor(traffic, 10);
      net.cutEdge(e); traffic.onCut(e); net.topologyChanged([e], 'RIP');
      // count looping bundles that die: by TTL, or tail-dropped on the link the loop jams
      let looped = 0; const prev = traffic.engine.hooks.drop;
      traffic.engine.hooks.drop = b => { if (b.opt.expire === 'ttl') looped++; prev(b); };
      for (let r = 0; r < 6; r++) { net.dvRound(); runFor(traffic, 40); }
      traffic.engine.hooks.drop = prev;
      expect(looped).toBeGreaterThan(0);
      const nushki = G.N('Nushki').id, kharan = G.N('Kharan').id;
      traffic.sample(); runFor(traffic, 20); traffic.sample();
      expect(G.adj.get(nushki).find(x => x.a === kharan || x.b === kharan).util).toBeGreaterThan(0.5); // the loop link is busy
      for (let r = 0; r < 30; r++) net.dvRound(); // let it reach 16
      const before = traffic.engine.counters.droppedBy.unreachable;
      runFor(traffic, 30);
      expect(traffic.engine.counters.droppedBy.unreachable).toBeGreaterThan(before); // now dropped as unreachable
    } finally { state.protocol = 'BGP'; }
  });

  it('at night (03:00) the network is lightly loaded', () => {
    state.simHour = 3;
    runFor(traffic, 40); traffic.sample(); runFor(traffic, 40); const m = traffic.sample();
    expect(m.intlTbps).toBeLessThan(6);
    expect(m.lossPct).toBeLessThan(0.5);
  });
});

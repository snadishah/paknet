// The five illustrative offices: attachment, traceroute = routing path, live re-routing, real flows.
import { describe, it, expect, beforeEach } from 'vitest';
import { buildTopology } from '../src/graph/topology.js';
import { createNetwork } from '../src/sim/network.js';
import { createTraffic } from '../src/sim/traffic.js';
import { addOffices, createOffices, OFFICES, DESTS } from '../src/sim/offices.js';
import { state } from '../src/state.js';
import { TIME_SCALE_MS } from '../src/sim/params.js';

const quiet = { drop() {}, arrive() {} };

describe('offices', () => {
  let G, net, traffic, off;
  beforeEach(() => {
    Object.assign(state, { simHour: 21, plannedActive: false, convergeUntil: 0, staleSet: new Set(), protocol: 'OSPF', epoch: 0 });
    G = buildTopology(); addOffices(G); net = createNetwork(G); traffic = createTraffic(G, net); off = createOffices(G, net, traffic);
  });

  it('adds five illustrative host nodes, each attached to its own city router', () => {
    expect(G.OFFICES).toHaveLength(5);
    for (const o of G.OFFICES) {
      expect(o.tier).toBe('office'); expect(o.illustrative).toBe(true);
      const cfg = OFFICES.find(x => x.key === o.key);
      expect(o.parent.name).toBe(cfg.city);
      expect(G.adj.get(o.id)).toHaveLength(1);
      expect(G.adj.get(o.id)[0].b).toBe(o.parent.id);
    }
  });

  it('adding offices does not change routes between existing cities', () => {
    const G0 = buildTopology(); const net0 = createNetwork(G0);
    for (const [a, b] of [['Karachi', 'Lahore'], ['Quetta', 'Islamabad'], ['Peshawar', 'Multan']]) {
      const p0 = net0.forward(G0.N(a).id, G0.N(b).id), p1 = net.forward(G.N(a).id, G.N(b).id);
      expect(p1.seq).toEqual(p0.seq);
    }
  });

  it('traceroute hops are exactly the routing module path', () => {
    for (const o of G.OFFICES) for (const k of Object.keys(DESTS)) {
      const tr = off.traceroute(o.key, k); const p = off.pathTo(o, k);
      expect(tr.hops.map(h => h.node.id)).toEqual(p.seq);
      expect(tr.hops.slice(1).map(h => h.edge.id)).toEqual(p.edges.map(e => e.id));
      // the first leg is what net.forward says
      if (DESTS[k].kind === 'intl' && p.cable) { const ls = p.seq[p.seq.length - 2]; expect(p.seq.slice(0, -1)).toEqual(net.forward(o.id, ls).seq); }
      expect(tr.hops.every((h, i) => i === 0 || h.ms > 0)).toBe(true);
    }
  });

  it('the email to Lahore stays in Pakistan and goes through an internet exchange', () => {
    const tr = off.traceroute('karachi', 'email');
    expect(tr.hops.some(h => h.node.tier === 'ixp')).toBe(true);
    expect(tr.hops.at(-1).node.key).toBe('lahore');
    expect(tr.hops.some(h => h.node.tier === 'intl')).toBe(false);
  });

  it('cutting the office\'s cable changes its path live', () => {
    const before = off.traceroute('karachi', 'youtube'); expect(before.cable).toBeTruthy();
    before.cable.edges.forEach(e => net.cutEdge(e)); net.topologyChanged(before.cable.edges, 'OSPF');
    const after = off.traceroute('karachi', 'youtube');
    expect(after.cable.id).not.toBe(before.cable.id);
    expect(after.hops.map(h => h.node.id)).not.toEqual(before.hops.map(h => h.node.id));
  });

  it('office flows are real bundles in the packet engine (getFlowsFrom)', () => {
    for (let t = 0; t < 3; t += 1 / 60) { off.spawn(1 / 60); traffic.advance(1 / 60, quiet); }
    const flows = off.getFlowsFrom('karachi');
    expect(flows.length).toBeGreaterThan(0);
    expect(flows.every(b => b.opt.office === 'karachi' && b.seq[0] === off.byKey.karachi.id)).toBe(true);
    // they get delivered and measured
    for (let t = 0; t < 200; t += 1 / 60 * TIME_SCALE_MS) traffic.advance(1 / 60, quiet);
    expect(off.traceroute('karachi', 'youtube').measuredMs ?? off.traceroute('karachi', 'email').measuredMs).not.toBeNull();
  });
});

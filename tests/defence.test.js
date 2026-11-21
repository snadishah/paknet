// The MAPE-K defence on the whole simulated network.
import { describe, it, expect, beforeEach } from 'vitest';
import { buildTopology } from '../src/graph/topology.js';
import { createNetwork } from '../src/sim/network.js';
import { createTraffic } from '../src/sim/traffic.js';
import { createMapeK } from '../src/defence/mapek.js';
import { state } from '../src/state.js';
import { TIME_SCALE_MS, DEFENCE } from '../src/sim/params.js';

const quiet = { drop() {}, arrive() {} };

function setup() {
  Object.assign(state, { simHour: 21, plannedActive: false, convergeUntil: 0, staleSet: new Set(), protocol: 'OSPF' });
  const G = buildTopology(), net = createNetwork(G), traffic = createTraffic(G, net);
  const acted = [];
  const defence = createMapeK({
    protect: new Set(G.DCS.filter(d => !d.scrub).map(d => d.id)), rov: () => 'notfound',
    params: DEFENCE, effectors: { divert: d => acted.push(['divert', d]), quarantine: s => acted.push(['quarantine', s]), deployRov: () => acted.push(['rov']) }
  });
  traffic.telemetry.onInject = (b, t) => defence.observeFlow(b, t);
  const step = (extra = () => {}) => { const s = 1 / 60; extra(s); defence.tick(traffic.engine.now); traffic.advance(s, quiet); };
  const runFor = (ms, extra) => { for (let t = 0; t < ms; t += TIME_SCALE_MS / 60) step(extra); };
  return { G, net, traffic, defence, acted, runFor };
}

describe('MAPE-K defence', () => {
  let env;
  beforeEach(() => { env = setup(); });

  it('raises no alarms on a normal evening (no false positives)', () => {
    env.runFor(60);
    expect(env.acted).toEqual([]);
    expect(env.defence.log.filter(e => e.phase === 'analyse')).toHaveLength(0);
  });

  it('detects an 8 Tbps flood within a few windows, then diverts it', () => {
    const { G, net, traffic, defence, acted, runFor } = env;
    runFor(10); // learn the baseline
    const target = G.DCS[1], scrub = G.DCS.find(d => d.scrub);
    let dst = target; const t0 = traffic.engine.now;
    const flood = s => {
      for (let i = 0; i < 8 * TIME_SCALE_MS / 0.1 * s; i++) {
        const ce = traffic.pickCableEdge(); const p = net.route(dst.id, ce.a);
        traffic.emitPacket({ seq: [ce.b, ...[...p.seq].reverse()], edges: [ce, ...[...p.edges].reverse()] }, 'atk', { sink: true });
      }
      for (let i = 0; i < 0.8 * TIME_SCALE_MS / 0.1 * s; i++) { const p = net.route(traffic.pickCity().id, dst.id); if (p) traffic.emitPacket(p, 'atk', { sink: true }); } // botnet inside Pakistan
      if (acted.some(a => a[0] === 'divert')) dst = scrub; // the response
    };
    runFor(10, flood);
    const detect = defence.log.find(e => e.phase === 'analyse');
    expect(detect).toBeTruthy();
    expect(detect.t - t0).toBeLessThan(4 * DEFENCE.windowMs);
    expect(acted).toContainEqual(['divert', target.id]);
    const exec = defence.log.find(e => e.phase === 'execute');
    expect(exec.t - detect.t).toBeGreaterThanOrEqual(DEFENCE.planMs);
  });

  it('spots beaconing hidden among normal international traffic, and only that', () => {
    const { G, net, traffic, acted, runFor } = env;
    const mardan = G.N('Mardan'); let next = traffic.engine.now;
    const beacon = () => {
      while (next <= traffic.engine.now) {
        next += 0.1;
        const ce = traffic.pickCableEdge(); const cls = G.nodes[ce.a].tier === 'intl' ? ce.b : ce.a;
        const p = net.route(mardan.id, cls);
        traffic.emitPacket({ seq: [...p.seq, ce.a === cls ? ce.b : ce.a], edges: [...p.edges, ce] }, 'atk', { dstAddr: 'c2-server' });
      }
    };
    runFor(10, beacon);
    expect(acted).toEqual([['quarantine', mardan.id]]);
  });
});

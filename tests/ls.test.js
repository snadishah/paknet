// Link-state routing (OSPF) on the real topology.
import { describe, it, expect, beforeEach } from 'vitest';
import { buildTopology } from '../src/graph/topology.js';
import { buildRouterGraph } from '../src/routing/routergraph.js';
import { Heap } from '../src/routing/dijkstra.js';
import { createLS } from '../src/routing/ls.js';
import { edgeCapacityGbps, edgeDelayMs } from '../src/sim/links.js';
import { OSPF } from '../src/sim/params.js';

const G = buildTopology();
const id = n => G.N(n).id;
const usable = e => !e.cut && e.type !== 'planned' && !(e.cable && e.cable.status !== 'live');
const costOf = e => Math.max(1, Math.round(OSPF.refGbps / edgeCapacityGbps(G, e)));
const make = (params = OSPF) => createLS(G, { usable, costOf, delayOf: edgeDelayMs, params });
const runUntilQuiet = (ls, step = 1) => { let t = ls.now; while (ls.busy && t < ls.now + 1e6) { t += step; ls.advance(t); } };
const kkh = () => G.adj.get(id('Chilas')).find(e => e.type === 'fiber' && [G.nodes[e.a].name, G.nodes[e.b].name].includes('Gilgit'));
const khiHyd = () => G.adj.get(id('Karachi')).find(e => e.type === 'fiber' && [G.nodes[e.a].name, G.nodes[e.b].name].includes('Hyderabad'));

// Independent reference: Dijkstra on the true router graph with the same costs.
function refCost(a, b) {
  const { routers, idx, stub, nbrs } = buildRouterGraph(G);
  const dist = new Map([[idx.get(a), 0]]), h = new Heap(); h.push([0, idx.get(a)]); const done = new Set();
  while (h.size) {
    const [d, u] = h.pop(); if (done.has(u)) continue; done.add(u);
    if (u === idx.get(b)) return d;
    if (stub[u] && u !== idx.get(a)) continue;
    for (const nb of nbrs[u]) {
      const up = nb.links.filter(L => L.edges.every(usable)); if (!up.length) continue;
      const c = Math.min(...up.map(L => L.edges.reduce((s, e) => s + costOf(e), 0)));
      if (d + c < (dist.get(nb.j) ?? Infinity)) { dist.set(nb.j, d + c); h.push([d + c, nb.j]); }
    }
  }
  return Infinity; void routers;
}

describe('link state: steady state', () => {
  beforeEach(() => G.edges.forEach(e => (e.cut = false)));
  it('every router computes least-cost paths from its own database', () => {
    const ls = make();
    for (const [a, b] of [['Karachi', 'Lahore'], ['Gilgit', 'Quetta'], ['Gwadar', 'Peshawar']]) expect(ls.pathCost(id(a), id(b))).toBe(refCost(id(a), id(b)));
    expect(ls.consistent()).toBe(true);
  });
  it('prefers fibre over the low-capacity microwave chain', () => {
    const p = make().forward(id('Rawalpindi'), id('Gilgit'));
    expect(p.fate).toBe('ok');
    expect(p.seq.some(v => G.nodes[v].tier === 'tower')).toBe(false);
  });
});

describe('link state: a failure', () => {
  beforeEach(() => G.edges.forEach(e => (e.cut = false)));

  it('converges to correct tables everywhere, avoiding the cut', () => {
    const ls = make(); let report = null; ls.hooks.converged = r => (report = r);
    const e = khiHyd(); e.cut = true; ls.linkChanged(e); runUntilQuiet(ls);
    expect(ls.consistent()).toBe(true);
    expect(report).not.toBeNull();
    const p = ls.forward(id('Karachi'), id('Lahore'));
    expect(p.fate).toBe('ok'); expect(p.edges).not.toContain(e);
    expect(ls.pathCost(id('Karachi'), id('Lahore'))).toBe(refCost(id('Karachi'), id('Lahore')));
  });

  it('convergence ≈ detection + LSA delay + flooding + SPF delay (loss of light)', () => {
    const ls = make(); let r = null; ls.hooks.converged = x => (r = x);
    const e = khiHyd(); e.cut = true; ls.linkChanged(e); runUntilQuiet(ls);
    expect(r.detectMs).toBe(OSPF.carrierMs);
    const floor = OSPF.carrierMs + OSPF.lsaDelayMs + OSPF.spfDelayMs + OSPF.spfRunMs;
    expect(r.totalMs).toBeGreaterThan(floor);
    expect(r.totalMs).toBeLessThan(floor + 150); // flooding across the country takes tens of ms
    expect(r.routersUpdated).toBeGreaterThan(50);
  });

  it('waiting for the dead interval adds ~40 s', () => {
    const ls = make(); ls.opts.detect = 'hello'; let r = null; ls.hooks.converged = x => (r = x);
    const e = khiHyd(); e.cut = true; ls.linkChanged(e); runUntilQuiet(ls, 50);
    expect(r.detectMs).toBe(OSPF.helloDeadMs);
    expect(r.totalMs).toBeGreaterThan(40000);
  });

  it('the flood is a wave: nearby routers hear first', () => {
    const ls = make(); const heard = new Map();
    ls.hooks.lsa = (router) => { if (!heard.has(router)) heard.set(router, ls.now); };
    const e = khiHyd(); e.cut = true; ls.linkChanged(e); runUntilQuiet(ls, 0.5);
    expect(heard.get(id('Thatta'))).toBeLessThan(heard.get(id('Lahore')));
    expect(heard.get(id('Lahore'))).toBeLessThan(heard.get(id('Peshawar')));
  });

  it('before routers hear about it, they still forward into the dead link (black hole)', () => {
    const ls = make();
    const e = khiHyd(); e.cut = true; ls.linkChanged(e);
    ls.advance(OSPF.carrierMs + 1); // detected at the ends, LSAs not yet sent
    const p = ls.forward(id('Lahore'), id('Karachi'));
    expect(p.edges).toContain(e); // Lahore's stale table still points through Hyderabad–Karachi
    runUntilQuiet(ls);
    expect(ls.forward(id('Lahore'), id('Karachi')).edges).not.toContain(e);
  });

  it('slower per-hop processing means slower convergence', () => {
    const fast = make({ ...OSPF, procMs: 1 }), slow = make({ ...OSPF, procMs: 20 });
    const res = [];
    for (const ls of [fast, slow]) {
      G.edges.forEach(x => (x.cut = false));
      ls.hooks.converged = r => res.push(r.totalMs);
      const e = kkh(); e.cut = true; ls.linkChanged(e); runUntilQuiet(ls, 0.5);
    }
    expect(res[1]).toBeGreaterThan(res[0]);
  });
});

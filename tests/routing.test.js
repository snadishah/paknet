// Characterisation tests for the graph and routing modules, written during the
// module split so later changes can't silently break shortest-path routing.
import { describe, it, expect, beforeEach } from 'vitest';
import { buildTopology } from '../src/graph/topology.js';
import { dijkstra, Heap } from '../src/routing/dijkstra.js';
import { buildPath, reversePath, concatPaths, nodeSeq } from '../src/routing/paths.js';
import { createNetwork } from '../src/sim/network.js';
import { state } from '../src/state.js';

const G = buildTopology();
const id = name => G.N(name).id;

describe('topology', () => {
  it('has the core cities, four live landing stations and nine non-retired cables', () => {
    for (const c of ['Karachi', 'Lahore', 'Islamabad', 'Quetta', 'Gwadar']) expect(G.N(c)?.tier).toBe('core');
    expect(G.CABLES.filter(c => c.status !== 'retired')).toHaveLength(9);
    // 26 microwave links Rawalpindi → Karimabad = 25 relays (REFERENCES §1.2)
    expect(G.towers).toHaveLength(25);
    expect(G.edges.filter(e => e.type === 'mwbackup')).toHaveLength(26);
  });
  it('has PIE Karachi alongside the three PKIX sites', () => {
    expect(G.IXP.map(n => n.name)).toContain('PIE Karachi (DE-CIX / PTCL)');
    expect(G.IXP).toHaveLength(4);
  });
  it('keeps Africa-1 and 2Africa landed but out of service', () => {
    for (const id of ['AFR1', '2AFR']) expect(G.CABLES.find(c => c.id === id).status).toBe('landed');
  });
  it('lands every cable in Karachi landing stations except the planned Gwadar one', () => {
    for (const e of G.cableEdges) expect(G.nodes[e.a].tier).toBe('cls');
    expect(G.cableEdges.every(e => !G.nodes[e.a].planned)).toBe(true);
  });
});

describe('Heap', () => {
  it('pops in ascending key order', () => {
    const h = new Heap(); [5, 1, 4, 2, 3].forEach(k => h.push([k, k]));
    const out = []; while (h.size) out.push(h.pop()[0]);
    expect(out).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('dijkstra', () => {
  it('finds a Karachi → Lahore path that is contiguous', () => {
    const r = dijkstra(G, id('Karachi'), id('Lahore'));
    expect(r).not.toBeNull();
    const seq = nodeSeq(id('Karachi'), r.edges);
    expect(seq[0]).toBe(id('Karachi'));
    expect(seq.at(-1)).toBe(id('Lahore'));
  });
  it('fewest-hops is never longer in hops than lowest-latency', () => {
    const a = dijkstra(G, id('Gilgit'), id('Karachi'), { metric: 'hops' });
    const b = dijkstra(G, id('Gilgit'), id('Karachi'), { metric: 'latency' });
    expect(a.edges.length).toBeLessThanOrEqual(b.edges.length);
  });
  it('routes around a cut edge, and never uses it', () => {
    const r1 = dijkstra(G, id('Karachi'), id('Lahore'));
    const first = r1.edges.find(e => e.type === 'fiber');
    const r2 = dijkstra(G, id('Karachi'), id('Lahore'), { usable: e => e !== first });
    expect(r2).not.toBeNull();
    expect(r2.edges).not.toContain(first);
  });
  it('never transits an international endpoint', () => {
    const r = dijkstra(G, id('Peshawar'), id('Quetta'));
    for (const v of nodeSeq(id('Peshawar'), r.edges).slice(1, -1)) expect(G.nodes[v].tier).not.toBe('intl');
  });
});

describe('paths', () => {
  it('reverse of reverse has the same length and endpoints', () => {
    const r = dijkstra(G, id('Multan'), id('Peshawar'));
    const p = buildPath(id('Multan'), r.edges), rr = reversePath(reversePath(p));
    expect(rr.total).toBeCloseTo(p.total, 5);
    expect(Array.from(rr.arr.slice(0, 3))).toEqual(Array.from(p.arr.slice(0, 3)));
  });
  it('concatenation adds lengths', () => {
    const a = buildPath(id('Karachi'), dijkstra(G, id('Karachi'), id('Multan')).edges);
    const b = buildPath(id('Multan'), dijkstra(G, id('Multan'), id('Lahore')).edges);
    expect(concatPaths(a, b).total).toBeCloseTo(a.total + b.total, 5);
  });
});

describe('network', () => {
  beforeEach(() => { state.plannedActive = false; state.protocol = 'BGP'; G.edges.forEach(e => (e.cut = false)); }); // the stale-route mock is BGP-only
  it('treats landed-but-inactive cables and planned links as unusable', () => {
    const net = createNetwork(G);
    const afr = G.CABLES.find(c => c.id === 'AFR1');
    expect(net.usable(afr.edges[0])).toBe(false);
    expect(net.usable(G.plannedEdges[0])).toBe(false);
    state.plannedActive = true;
    expect(net.usable(G.plannedEdges[0])).toBe(true);
  });
  it('a cut bumps the epoch and invalidates cached routes', () => {
    const net = createNetwork(G);
    const before = net.route(id('Karachi'), id('Lahore'));
    const e = before.edges.find(x => x.type === 'fiber');
    net.cutEdge(e); net.topologyChanged([e], 'OSPF');
    const after = net.route(id('Karachi'), id('Lahore'));
    expect(after.edges).not.toContain(e);
    expect(net.route(id('Karachi'), id('Lahore'), true).edges).toContain(e); // stale view still uses it
  });
});

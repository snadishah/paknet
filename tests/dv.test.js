// Distance-vector routing on the real topology.
import { describe, it, expect, beforeEach } from 'vitest';
import { buildTopology } from '../src/graph/topology.js';
import { createDV, INFINITY } from '../src/routing/dv.js';

const G = buildTopology();
const id = n => G.N(n).id;
const usable = e => !e.cut && !(e.type === 'planned') && !(e.cable && e.cable.status !== 'live');
const nkTaftan = () => G.adj.get(id('Nok Kundi')).find(e => G.nodes[e.a].name === 'Taftan' || G.nodes[e.b].name === 'Taftan');

// Hop distances by breadth-first search over the same router graph, for comparison.
function bfs(dv, from) {
  const d = new Map([[from, 0]]), q = [from];
  while (q.length) {
    const u = q.shift();
    for (const v of dv.routers) if (!d.has(v) && dv.nextHop(u, v) === v) { /* not used */ }
    for (const e of G.adj.get(u)) {
      const w = e.a === u ? e.b : e.a; if (!usable(e)) continue;
      if (dv.isRouter(w) && !d.has(w) && ['fiber', 'metro', 'microwave', 'aerial', 'xborder', 'subsea'].includes(e.type) && G.nodes[u].tier !== 'intl') { d.set(w, d.get(u) + 1); q.push(w); }
    }
  }
  return d;
}

describe('distance vector: convergence', () => {
  beforeEach(() => G.edges.forEach(e => (e.cut = false)));

  it('converges to shortest hop counts', () => {
    const dv = createDV(G, { usable });
    const rounds = dv.converge();
    expect(rounds).toBeGreaterThan(3);
    expect(rounds).toBeLessThan(20);
    const ref = bfs(dv, id('Karachi'));
    for (const n of ['Lahore', 'Quetta', 'Peshawar', 'Gwadar', 'Taftan']) expect(dv.distance(id('Karachi'), id(n))).toBe(ref.get(id(n)));
  });

  it('treats the microwave backup chain as one hop', () => {
    const dv = createDV(G, { usable }); dv.converge();
    // cut the KKH fibre: Gilgit is reached over the 26-link chain, which counts as 1
    const kkh = G.adj.get(id('Chilas')).find(e => e.type === 'fiber' && [G.nodes[e.a].name, G.nodes[e.b].name].includes('Gilgit'));
    kkh.cut = true; dv.converge();
    expect(dv.distance(id('Rawalpindi'), id('Karimabad'))).toBe(1);
    const p = dv.forward(id('Rawalpindi'), id('Gilgit'));
    expect(p.fate).toBe('ok');
    expect(p.seq.some(v => G.nodes[v].tier === 'tower')).toBe(true); // the path really walks the relays
  });
});

describe('distance vector: count-to-infinity (cut Nok Kundi–Taftan)', () => {
  beforeEach(() => G.edges.forEach(e => (e.cut = false)));

  function cutAndWatch(opts) {
    G.edges.forEach(e => (e.cut = false));
    const dv = createDV(G, { usable, ...opts }); dv.converge();
    nkTaftan().cut = true;
    const nk = [], dal = [];
    for (let r = 0; r < 40; r++) { dv.step(); nk.push(dv.distance(id('Nok Kundi'), id('Taftan'))); dal.push(dv.distance(id('Dalbandin'), id('Taftan'))); }
    return { dv, nk, dal };
  }

  it('without split horizon, routers count up to 16 over many rounds', () => {
    const { nk, dal } = cutAndWatch({});
    const finite = nk.filter(x => x > 1 && x < INFINITY);
    expect(finite.length).toBeGreaterThan(3);              // took bogus finite routes for a while
    expect(Math.max(...finite)).toBeGreaterThan(8);         // and counted up
    expect(nk.at(-1)).toBe(INFINITY); expect(dal.at(-1)).toBe(INFINITY); // ends unreachable
  });

  it('while counting, traffic loops until its TTL runs out', () => {
    const dv = createDV(G, { usable }); dv.converge();
    nkTaftan().cut = true; dv.step(); dv.step(); dv.step();
    const p = dv.forward(id('Dalbandin'), id('Taftan'));
    expect(p.fate).toBe('ttl');
    expect(new Set(p.seq).size).toBeLessThan(p.seq.length); // it visited routers more than once
  });

  it('split horizon stops the two-router bounce at once…', () => {
    const { nk, dal } = cutAndWatch({ splitHorizon: true });
    expect(nk.slice(0, 8).every(x => x === INFINITY)).toBe(true); // never takes the route back from Dalbandin
    expect(dal.slice(1, 8).every(x => x === INFINITY)).toBe(true);
  });

  it('…but a stale route can still circle a larger loop and count up (split horizon\'s known limit)', () => {
    for (const opts of [{ splitHorizon: true }, { poisonReverse: true }]) {
      const { nk } = cutAndWatch(opts);
      expect(nk.some(x => x > 1 && x < INFINITY)).toBe(true); // came back around the big cycle
      expect(nk.slice(20).every(x => x === INFINITY)).toBe(true); // still ends unreachable
    }
  });

  it('routes come back after the link is restored', () => {
    const { dv } = cutAndWatch({ splitHorizon: true });
    nkTaftan().cut = false; dv.converge();
    expect(dv.distance(id('Nok Kundi'), id('Taftan'))).toBe(1);
    expect(dv.forward(id('Quetta'), id('Taftan')).fate).toBe('ok');
  });
});

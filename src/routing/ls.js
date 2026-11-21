// Link-state routing (OSPF-style). Pure: no three.js, no DOM.
//
// RFC 2328, simplified to one area:
//   - every router originates a Router-LSA listing its live neighbours and costs
//     (cost = reference bandwidth / link capacity)
//   - LSAs flood hop by hop: a router that receives a newer LSA (higher sequence
//     number) stores it and passes it to all other neighbours
//   - each router runs Dijkstra (SPF) on ITS OWN database, after an SPF delay,
//     and installs next hops; a link is used only if both ends list each other
//     (the two-way check, RFC 2328 §16.1)
//   - a failure is noticed after a detection delay: loss of light (fast) or the
//     40 s RouterDeadInterval when Hellos stop arriving
//
// Event-driven on its own clock (ms of OSPF time). While routers disagree,
// forwarding follows each router's own table, so black holes and micro-loops
// during convergence emerge rather than being scripted.
import { Heap } from './dijkstra.js';
import { buildRouterGraph, walkLink } from './routergraph.js';

const TTL = 32;

/**
 * @param {object} G
 * @param {object} o
 * @param {(e) => boolean} o.usable     is the physical edge up (the truth)
 * @param {(e) => number} o.costOf      OSPF cost of an edge
 * @param {(e) => number} o.delayOf     propagation delay of an edge, ms
 * @param {object} o.params             OSPF timers (see sim/params.js)
 */
export function createLS(G, { usable, costOf, delayOf, params }) {
  const P = { ...params };
  const opts = { detect: 'carrier' }; // 'carrier' (loss of light) | 'hello' (dead interval)
  const { routers, idx, stub, nbrs, linksOf } = buildRouterGraph(G);
  const R = routers.length;
  const hooks = { lsa: null, install: null, converged: null, originate: null };

  const linkUp = L => L.edges.every(usable);
  const linkCost = L => L.edges.reduce((a, e) => a + costOf(e), 0);
  const linkDelay = L => L.edges.reduce((a, e) => a + delayOf(e), 0);
  const upLinks = n => n.links.filter(linkUp);

  // What router i would advertise right now (the physical truth around it).
  function adjacency(i) {
    const out = [];
    for (const n of nbrs[i]) { const up = upLinks(n); if (up.length) out.push([n.j, Math.min(...up.map(linkCost))]); }
    return new Map(out);
  }
  const sameAdj = (a, b) => a.size === b.size && [...a].every(([j, c]) => b.get(j) === c);

  // databases: lsdb[i][o] = the LSA from router o that router i holds (LSAs are shared, immutable)
  const lsaCur = routers.map((_, o) => ({ o, seq: 1, m: adjacency(o) }));
  const lsdb = routers.map(() => lsaCur.slice());
  const next = routers.map(() => new Int16Array(R).fill(-1));
  const cost = routers.map(() => new Float64Array(R).fill(Infinity));
  for (let i = 0; i < R; i++) spf(i);

  function spf(s) {
    const db = lsdb[s], dist = cost[s].fill(Infinity), first = next[s].fill(-1);
    dist[s] = 0; const h = new Heap(); h.push([0, s]); const done = new Uint8Array(R);
    while (h.size) {
      const [d, u] = h.pop(); if (done[u]) continue; done[u] = 1;
      if (stub[u] && u !== s) continue; // endpoints don't carry transit
      for (const [j, c] of db[u].m) {
        if (!db[j] || !db[j].m.has(u)) continue; // two-way check
        const nd = d + c;
        if (nd < dist[j]) { dist[j] = nd; first[j] = u === s ? j : first[u]; h.push([nd, j]); }
      }
    }
  }

  /* ---------- events ---------- */
  let now = 0;
  const events = new Heap(); // [t, ev], ordered by time
  const at = (t, ev) => events.push([t, ev]);
  const pendingOrig = new Uint8Array(R), pendingSpf = new Uint8Array(R);
  let watch = null; // measurement of the current convergence

  function startWatch() { if (!watch) watch = { t0: now, firstDetect: null, firstOriginate: null, lastLsa: null, lastInstall: null, installs: 0, lsaArrivals: 0 }; }

  // A physical edge went down or came back: both ends of every logical link
  // that uses it notice after the detection delay.
  function linkChanged(e) {
    const Ls = linksOf.get(e); if (!Ls) return;
    startWatch();
    const down = !usable(e);
    for (const L of Ls) for (const r of [L.a, L.b]) at(now + detectDelay(down), { type: 'detect', i: idx.get(r) });
  }
  const detectDelay = down => (opts.detect === 'carrier' ? P.carrierMs : down ? P.helloDeadMs : P.helloUpMs);

  // Compare every router's advertisement with the truth and let the ones whose
  // surroundings changed notice (covers cuts, restores and what-ifs at once).
  function resync() {
    let any = false;
    for (let i = 0; i < R; i++) {
      const m = adjacency(i), cur = lsaCur[i].m; if (sameAdj(m, cur)) continue;
      const lost = [...cur.keys()].some(j => !m.has(j));
      if (!any) { startWatch(); any = true; }
      at(now + detectDelay(lost), { type: 'detect', i });
    }
    return any;
  }

  function handle(ev) {
    const i = ev.i;
    if (ev.type === 'detect') {
      if (watch && watch.firstDetect == null) watch.firstDetect = now;
      if (!sameAdj(adjacency(i), lsaCur[i].m) && !pendingOrig[i]) { pendingOrig[i] = 1; at(now + P.lsaDelayMs, { type: 'originate', i }); }
    } else if (ev.type === 'originate') {
      pendingOrig[i] = 0;
      const m = adjacency(i); if (sameAdj(m, lsaCur[i].m)) return;
      const lsa = { o: i, seq: lsaCur[i].seq + 1, m }; lsaCur[i] = lsa; lsdb[i][i] = lsa;
      if (watch && watch.firstOriginate == null) watch.firstOriginate = now;
      hooks.originate?.(routers[i]);
      scheduleSpf(i); flood(i, lsa, -1);
    } else if (ev.type === 'lsa') {
      const cur = lsdb[i][ev.lsa.o];
      if (cur && cur.seq >= ev.lsa.seq) return; // old news
      lsdb[i][ev.lsa.o] = ev.lsa;
      if (watch) { watch.lastLsa = now; watch.lsaArrivals++; }
      hooks.lsa?.(routers[i], routers[ev.lsa.o]);
      scheduleSpf(i); flood(i, ev.lsa, ev.from);
    } else if (ev.type === 'spf') {
      pendingSpf[i] = 0; spf(i);
      if (watch) { watch.lastInstall = now; watch.installs++; }
      hooks.install?.(routers[i]);
    }
  }

  function flood(i, lsa, from) {
    for (const nb of nbrs[i]) {
      if (nb.j === from) continue;
      const up = upLinks(nb); if (!up.length) continue;
      const d = Math.min(...up.map(linkDelay));
      at(now + d + P.procMs, { type: 'lsa', i: nb.j, lsa, from: i });
    }
  }
  function scheduleSpf(i) { if (!pendingSpf[i]) { pendingSpf[i] = 1; at(now + P.spfDelayMs + P.spfRunMs, { type: 'spf', i }); } }

  // Process events up to OSPF time t (ms).
  function advance(t) {
    while (events.size && events.a[0][0] <= t) { const [et, ev] = events.pop(); now = et; handle(ev); }
    if (t > now) now = t;
    if (watch && !events.size) {
      const w = watch; watch = null;
      const end = w.lastInstall ?? now;
      hooks.converged?.({
        totalMs: end - w.t0,
        detectMs: (w.firstDetect ?? w.t0) - w.t0,
        floodMs: w.lastLsa != null && w.firstOriginate != null ? w.lastLsa - w.firstOriginate : 0,
        routersUpdated: w.installs, lsaArrivals: w.lsaArrivals
      });
    }
  }
  const nextEventIn = () => (events.size ? events.a[0][0] - now : Infinity);

  /* ---------- forwarding ---------- */
  // Follow each router's OWN next hop. A router that hasn't heard about a
  // failure still sends into the dead link, and the packet is lost there.
  function forward(a, b) {
    const seq = [a], edges = []; let cur = a, hops = 0; const kb = idx.get(b);
    while (cur !== b) {
      const i = idx.get(cur);
      if (hops >= TTL) return { seq, edges, fate: 'ttl' };
      const j = next[i][kb]; if (j < 0) return { seq, edges, fate: 'unreachable' };
      const nb = nbrs[i].find(x => x.j === j);
      const L = upLinks(nb).sort((x, y) => linkCost(x) - linkCost(y))[0] || nb.links[0];
      walkLink(L, cur, seq, edges); cur = routers[j]; hops++;
    }
    return { seq, edges, fate: 'ok' };
  }

  // Do all connected routers hold the same, up-to-date database? (Routers with no
  // live link, like the planned Gwadar station, can't be reached by flooding.)
  function consistent() {
    const live = routers.map((_, i) => adjacency(i).size > 0);
    return lsaCur.every((l, o) => !live[o] || sameAdj(l.m, adjacency(o))) &&
      lsdb.every((db, i) => !live[i] || db.every((l, o) => !live[o] || l === lsaCur[o]));
  }

  return {
    routers, opts, params: P, hooks, linkChanged, resync, advance, nextEventIn, forward, consistent,
    get watching() { return watch ? { t0: watch.t0, detected: watch.firstDetect != null } : null; },
    isRouter: id => idx.has(id),
    nextHop: (a, b) => { const j = next[idx.get(a)][idx.get(b)]; return j < 0 ? null : routers[j]; },
    pathCost: (a, b) => cost[idx.get(a)][idx.get(b)],
    get now() { return now; }, get busy() { return events.size > 0; }
  };
}

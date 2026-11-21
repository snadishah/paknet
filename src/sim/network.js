// Network state on top of the graph: which edges are usable, route lookup,
// forwarding by the active routing protocol, cuts/restores and convergence
// bookkeeping. Emits events; never touches rendering or the DOM.
//
// Protocols (state.protocol, chosen in the Failures tab):
//   RIP  — REAL distance vector (routing/dv.js). Traffic follows each router's
//          next hop, so loops and black holes during convergence emerge.
//   OSPF, BGP — still Dijkstra paths with a MOCKED convergence window (steps 5–6).
import { state } from '../state.js';
import { emit } from '../events.js';
import { dijkstra } from '../routing/dijkstra.js';
import { buildPath } from '../routing/paths.js';
import { createDV } from '../routing/dv.js';
import { RIP_UPDATE_S } from './params.js';

// Mocked convergence timing for the protocols that aren't simulated yet.
const CONV = {
  BGP: { T: 6500, secs: () => 30 + Math.random() * 25 },
  OSPF: { T: 2600, secs: () => 0.6 + Math.random() * 1.6 }
};

export function createNetwork(G) {
  const cache = new Map();

  function usable(e, ignoreCut) {
    if (e.type === 'planned' && !state.plannedActive) return false;
    if (e.cable && e.cable.status !== 'live' && !e.cable.forceLive) return false;
    if (e.cut && !ignoreCut?.has(e.id)) return false;
    return true;
  }

  const shortest = (src, dst, opt = {}) => dijkstra(G, src, dst, { ...opt, usable: e => usable(e, opt.ignoreCut) });

  // Dijkstra path with geometry. stale = as routers believed before the latest cuts.
  function route(src, dst, stale = false) {
    const k = src + '|' + dst + '|' + (stale ? 's' : state.epoch); if (cache.has(k)) return cache.get(k);
    const r = shortest(src, dst, stale ? { ignoreCut: state.staleSet } : {}); const p = r ? buildPath(src, r.edges) : null;
    if (cache.size > 6000) cache.clear(); cache.set(k, p); return p;
  }

  /* ---------- distance vector (RIP) ---------- */
  const dv = createDV(G, { usable: e => usable(e) }); // one argument only (usable's 2nd is ignoreCut)
  dv.converge(); // the network starts converged
  let dvEpoch = 0; const dvCache = new Map();
  let ripWatch = null; // { start } while measuring convergence after a change

  // A host (access city) sits behind its hub router: return [router, edge to it].
  const attach = id => {
    if (dv.isRouter(id)) return [id, null];
    const n = G.nodes[id];
    if (n.parent) return [n.parent.id, G.adj.get(id).find(e => e.a === n.parent.id || e.b === n.parent.id)];
    return [null, null];
  };

  // Path from src to dst by following RIP next hops. fate: 'ok' | 'unreachable' | 'ttl'.
  function dvPath(src, dst) {
    const k = src + '|' + dst + '|' + dvEpoch; if (dvCache.has(k)) return dvCache.get(k);
    const [rs, es] = attach(src), [rd, ed] = attach(dst);
    let p = null;
    if (rs != null && rd != null) {
      const mid = dv.forward(rs, rd);
      const seq = es ? [src, ...mid.seq] : [...mid.seq], edges = es ? [es, ...mid.edges] : [...mid.edges];
      if (mid.fate === 'ok' && ed) { seq.push(dst); edges.push(ed); }
      p = { seq, edges, fate: mid.fate };
      if (es && !usable(es)) p = { seq: [src], edges: [], fate: 'unreachable' };
    }
    if (dvCache.size > 6000) dvCache.clear(); dvCache.set(k, p); return p;
  }

  // One RIP update round (called on a compressed clock by the main loop).
  function dvRound() {
    const changed = dv.step(); dvEpoch++; dvCache.clear();
    emit('dv:round', { round: dv.round, changed });
    if (ripWatch && !changed) {
      const rounds = Math.max(0, dv.lastChange - ripWatch.start);
      state.lastConv = rounds * RIP_UPDATE_S; state.convergeUntil = 0;
      emit('rip:converged', { rounds }); ripWatch = null;
    }
  }
  function setDVOptions(o) { Object.assign(dv.opts, o); }

  /**
   * How a bundle from src to dst travels under the active protocol.
   * @returns {{seq, edges, fate}|null}
   */
  function forward(src, dst, stale = false) {
    if (state.protocol === 'RIP') { const p = dvPath(src, dst); if (p) return p; }
    const p = route(src, dst, stale);
    return p ? { seq: p.seq, edges: p.edges, fate: 'ok' } : null;
  }

  /* ---------- changes ---------- */
  function cutEdge(e) { if (e.cut) return; e.cut = true; emit('edge:cut', e); }
  function restoreEdge(e) { if (!e.cut) return; e.cut = false; emit('edge:restore', e); }

  function topologyChanged(cutEdges, algo = 'OSPF') {
    state.epoch++; cache.clear();
    let T = 0;
    if (state.protocol === 'RIP') {
      // real protocol: routers find out on the next rounds; measure how many it takes
      ripWatch = { start: dv.round };
      if (cutEdges && cutEdges.length) state.convergeUntil = Infinity; // "converging" until RIP settles
      algo = 'RIP';
    } else if (cutEdges && cutEdges.length) {
      const c = CONV[algo] || CONV.OSPF;
      state.staleSet = new Set(cutEdges.map(e => e.id)); state.convergeStart = performance.now();
      T = c.T; state.convergeT = T; state.convergeUntil = state.convergeStart + T; state.lastConv = c.secs();
    }
    emit('topology:changed', { cutEdges: cutEdges || [], algo, T });
  }

  function resetConvergence() { state.staleSet = new Set(); state.convergeUntil = 0; }

  const liveCables = () => G.CABLES.filter(c => (c.status === 'live' || c.forceLive) && c.edges.some(e => !e.cut));

  return { usable, shortest, route, forward, dv, dvPath, dvRound, setDVOptions, cutEdge, restoreEdge, topologyChanged, resetConvergence, liveCables };
}

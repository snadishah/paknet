// Network state on top of the graph: which edges are usable, route lookup,
// forwarding by the active routing protocol, cuts/restores and convergence
// bookkeeping. Emits events; never touches rendering or the DOM.
//
// Protocols (state.protocol, chosen in the Failures tab):
//   OSPF — REAL link state (routing/ls.js): detection, LSA flooding, per-router
//          SPF. Traffic follows each router's own table.
//   RIP  — REAL distance vector (routing/dv.js). Traffic follows each router's
//          next hop, so loops and black holes during convergence emerge.
//   BGP  — still Dijkstra paths with a MOCKED convergence window (step 6).
import { state } from '../state.js';
import { emit } from '../events.js';
import { dijkstra } from '../routing/dijkstra.js';
import { buildPath } from '../routing/paths.js';
import { createDV } from '../routing/dv.js';
import { createLS } from '../routing/ls.js';
import { edgeCapacityGbps, edgeDelayMs } from './links.js';
import { RIP_UPDATE_S, OSPF, OSPF_MS_PER_S, OSPF_FAST_MS_PER_S, OSPF_LONG_WAIT_MS } from './params.js';

// Mocked convergence timing for the protocol that isn't simulated yet.
const CONV = { BGP: { T: 6500, secs: () => 30 + Math.random() * 25 } };

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

  // Host-to-host path through a protocol's router-to-router forwarding.
  // fate: 'ok' | 'unreachable' | 'ttl'.
  function hostPath(proto, src, dst) {
    const [rs, es] = attach(src), [rd, ed] = attach(dst);
    if (rs == null || rd == null) return null;
    if (es && !usable(es)) return { seq: [src], edges: [], fate: 'unreachable' };
    const mid = proto.forward(rs, rd);
    const seq = es ? [src, ...mid.seq] : [...mid.seq], edges = es ? [es, ...mid.edges] : [...mid.edges];
    if (mid.fate === 'ok' && ed) { seq.push(dst); edges.push(ed); }
    return { seq, edges, fate: mid.fate };
  }
  // Path from src to dst by following RIP next hops.
  function dvPath(src, dst) {
    const k = src + '|' + dst + '|' + dvEpoch; if (dvCache.has(k)) return dvCache.get(k);
    const p = hostPath(dv, src, dst);
    if (dvCache.size > 6000) dvCache.clear(); dvCache.set(k, p); return p;
  }

  /* ---------- link state (OSPF) ---------- */
  const ospfCost = e => Math.max(1, Math.round(OSPF.refGbps / edgeCapacityGbps(G, e)));
  const ls = createLS(G, { usable: e => usable(e), costOf: ospfCost, delayOf: edgeDelayMs, params: OSPF });
  let lsEpoch = 0; const lsCache = new Map();
  ls.hooks.lsa = router => emit('ospf:lsa', { router });
  ls.hooks.install = router => { lsEpoch++; lsCache.clear(); emit('ospf:install', { router }); };
  ls.hooks.converged = r => {
    if (state.protocol === 'OSPF') { state.lastConv = r.totalMs / 1000; state.convergeUntil = 0; }
    emit('ospf:converged', r);
  };
  function lsPath(src, dst) {
    const k = src + '|' + dst + '|' + lsEpoch; if (lsCache.has(k)) return lsCache.get(k);
    const p = hostPath(ls, src, dst);
    if (lsCache.size > 6000) lsCache.clear(); lsCache.set(k, p); return p;
  }
  // Advance OSPF time by sdt wall seconds. Long pure waits (the 40 s dead
  // interval) are time-lapsed so a demo doesn't sit still for minutes.
  function lsAdvance(sdt) {
    const gap = ls.nextEventIn();
    const fast = gap > OSPF_LONG_WAIT_MS && gap !== Infinity;
    const target = fast ? Math.min(ls.now + sdt * OSPF_FAST_MS_PER_S, ls.now + gap) : ls.now + sdt * OSPF_MS_PER_S;
    ls.advance(target);
    const w = ls.watching;
    if (w) emit('ospf:progress', { elapsedMs: ls.now - w.t0, detected: w.detected, fast });
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
    if (state.protocol === 'OSPF') { const p = lsPath(src, dst); if (p) return p; }
    const p = route(src, dst, stale);
    return p ? { seq: p.seq, edges: p.edges, fate: 'ok' } : null;
  }

  /* ---------- changes ---------- */
  function cutEdge(e) { if (e.cut) return; e.cut = true; emit('edge:cut', e); }
  function restoreEdge(e) { if (!e.cut) return; e.cut = false; emit('edge:restore', e); }

  function topologyChanged(cutEdges, algo = 'OSPF') {
    state.epoch++; cache.clear();
    const lsChanged = ls.resync(); // OSPF always tracks the truth, whichever protocol forwards
    let T = 0;
    if (state.protocol === 'OSPF') {
      if (lsChanged && cutEdges && cutEdges.length) state.convergeUntil = Infinity; // converging until OSPF settles
      algo = 'OSPF';
    } else if (state.protocol === 'RIP') {
      // real protocol: routers find out on the next rounds; measure how many it takes
      ripWatch = { start: dv.round };
      if (cutEdges && cutEdges.length) state.convergeUntil = Infinity; // "converging" until RIP settles
      algo = 'RIP';
    } else if (cutEdges && cutEdges.length) {
      const c = CONV.BGP; algo = 'BGP';
      state.staleSet = new Set(cutEdges.map(e => e.id)); state.convergeStart = performance.now();
      T = c.T; state.convergeT = T; state.convergeUntil = state.convergeStart + T; state.lastConv = c.secs();
    }
    emit('topology:changed', { cutEdges: cutEdges || [], algo, T });
  }

  function resetConvergence() { state.staleSet = new Set(); state.convergeUntil = 0; }

  const liveCables = () => G.CABLES.filter(c => (c.status === 'live' || c.forceLive) && c.edges.some(e => !e.cut));

  return { usable, shortest, route, forward, dv, dvPath, dvRound, setDVOptions, ls, lsPath, lsAdvance, cutEdge, restoreEdge, topologyChanged, resetConvergence, liveCables };
}

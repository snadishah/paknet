// Network state on top of the graph: which edges are usable, route lookup with
// caching, cuts/restores and convergence bookkeeping. Emits events; never
// touches rendering or the DOM.
import { state } from '../state.js';
import { emit } from '../events.js';
import { dijkstra } from '../routing/dijkstra.js';
import { buildPath } from '../routing/paths.js';

// Mocked convergence timing per protocol (replaced by real protocols later).
const CONV = {
  BGP: { T: 6500, secs: () => 30 + Math.random() * 25 },
  RIP: { T: 9000, secs: () => 90 + Math.random() * 60 },
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

  // stale = route as routers still believed before the latest cuts
  function route(src, dst, stale = false) {
    const k = src + '|' + dst + '|' + (stale ? 's' : state.epoch); if (cache.has(k)) return cache.get(k);
    const r = shortest(src, dst, stale ? { ignoreCut: state.staleSet } : {}); const p = r ? buildPath(src, r.edges) : null;
    if (cache.size > 6000) cache.clear(); cache.set(k, p); return p;
  }

  function cutEdge(e) { if (e.cut) return; e.cut = true; emit('edge:cut', e); }
  function restoreEdge(e) { if (!e.cut) return; e.cut = false; emit('edge:restore', e); }

  function topologyChanged(cutEdges, algo = 'OSPF') {
    state.epoch++; cache.clear();
    let T = 0;
    if (cutEdges && cutEdges.length) {
      const c = CONV[algo] || CONV.OSPF;
      state.staleSet = new Set(cutEdges.map(e => e.id)); state.convergeStart = performance.now();
      T = c.T; state.convergeT = T; state.convergeUntil = state.convergeStart + T; state.lastConv = c.secs();
    }
    emit('topology:changed', { cutEdges: cutEdges || [], algo, T });
  }

  function resetConvergence() { state.staleSet = new Set(); state.convergeUntil = 0; }

  const liveCables = () => G.CABLES.filter(c => (c.status === 'live' || c.forceLive) && c.edges.some(e => !e.cut));

  return { usable, shortest, route, cutEdge, restoreEdge, topologyChanged, resetConvergence, liveCables };
}

// Shortest paths on the graph. Pure: no three.js, no DOM.

// Per-medium weight multipliers for the latency metric.
export const TYPEW = { fiber: 1, metro: 0.3, subsea: 1, access: 1.1, mwaccess: 1.3, microwave: 1.7, mwbackup: 1.9, aerial: 1.2, xborder: 1.2, sat: 60, planned: 1.15 };

export class Heap {
  constructor() { this.a = []; }
  push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a; const t = a[0], l = a.pop();
    if (a.length) { a[0] = l; let i = 0; for (;;) { let s = i; const L = 2 * i + 1, r = L + 1; if (L < a.length && a[L][0] < a[s][0]) s = L; if (r < a.length && a[r][0] < a[s][0]) s = r; if (s === i) break; [a[s], a[i]] = [a[i], a[s]]; i = s; } }
    return t;
  }
  get size() { return this.a.length; }
}

export function edgeWeight(e, metric = 'latency') {
  if (metric === 'hops') return 1;
  if (metric === 'cost') return (e.type === 'subsea' ? 3 : e.type === 'sat' ? 40 : 1) * (1 + e.len);
  return e.len * (TYPEW[e.type] || 1) + 0.02;
}

// opt.metric: 'latency' | 'hops' | 'cost'; opt.usable(e) decides which edges exist.
// International endpoints are never transit nodes.
export function dijkstra(G, src, dst, opt = {}) {
  const usable = opt.usable || (e => !e.cut);
  const metric = opt.metric || 'latency';
  const dist = new Map([[src, 0]]), prev = new Map(), order = [], h = new Heap(), done = new Set(); h.push([0, src]);
  while (h.size) {
    const [d, u] = h.pop(); if (done.has(u)) continue; done.add(u); order.push(u); if (u === dst) break;
    for (const e of G.adj.get(u)) {
      if (!usable(e)) continue; const v = e.a === u ? e.b : e.a; if (done.has(v)) continue;
      if (G.nodes[v].tier === 'intl' && v !== dst) continue;
      const nd = d + edgeWeight(e, metric); if (nd < (dist.get(v) ?? 1e18)) { dist.set(v, nd); prev.set(v, e); h.push([nd, v]); }
    }
  }
  if (!dist.has(dst)) return null;
  const pe = []; let cur = dst; while (cur !== src) { const e = prev.get(cur); pe.push(e); cur = e.a === cur ? e.b : e.a; }
  pe.reverse(); return { edges: pe, cost: dist.get(dst), order };
}

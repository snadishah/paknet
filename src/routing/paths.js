// Polyline paths built from edge sequences, used to move packets along routes.
// A path is { arr: Float32Array xyz, cum: cumulative length, total, edges, edgeStarts, n }.
// Pure: works on plain points that have .x/.y/.z and distanceTo().

export const nodeSeq = (src, pe) => { const s = [src]; let cur = src; for (const e of pe) { cur = e.a === cur ? e.b : e.a; s.push(cur); } return s; };

export function buildPath(src, pe) {
  const pts = []; let cur = src;
  for (const e of pe) { const fw = e.a === cur; const ep = fw ? e.pts : [...e.pts].reverse(); for (let i = pts.length ? 1 : 0; i < ep.length; i++) pts.push(ep[i]); cur = fw ? e.b : e.a; }
  const arr = new Float32Array(pts.length * 3), cum = new Float32Array(pts.length); let L = 0;
  pts.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z + 0.03; if (i) L += p.distanceTo(pts[i - 1]); cum[i] = L; });
  const edgeStarts = []; let acc = 0; for (const e of pe) { edgeStarts.push([acc, e]); acc += e.len; }
  return { arr, cum, total: L, edges: pe, edgeStarts, n: pts.length, seq: nodeSeq(src, pe) };
}

export function concatPaths(a, b) {
  if (!a) return b; if (!b) return a;
  const arr = new Float32Array((a.n + b.n - 1) * 3); arr.set(a.arr); arr.set(b.arr.subarray(3), a.n * 3);
  const cum = new Float32Array(a.n + b.n - 1); cum.set(a.cum); for (let i = 1; i < b.n; i++) cum[a.n - 1 + i] = a.total + b.cum[i];
  return { arr, cum, total: a.total + b.total, edges: [...a.edges, ...b.edges], edgeStarts: [...a.edgeStarts, ...b.edgeStarts.map(([d, e]) => [d + a.total, e])], n: a.n + b.n - 1, seq: [...a.seq, ...b.seq.slice(1)] };
}

export function reversePath(p) {
  const n = p.n, arr = new Float32Array(n * 3), cum = new Float32Array(n);
  for (let i = 0; i < n; i++) { arr.set(p.arr.subarray((n - 1 - i) * 3, (n - i) * 3), i * 3); cum[i] = p.total - p.cum[n - 1 - i]; }
  const es = []; let acc = 0; for (const e of [...p.edges].reverse()) { es.push([acc, e]); acc += e.len; }
  return { arr, cum, total: p.total, edges: [...p.edges].reverse(), edgeStarts: es, n, seq: [...p.seq].reverse() };
}

// Position at distance d along path p, written into out[0..2].
export function samplePath(p, d, out) {
  if (d <= 0) { out[0] = p.arr[0]; out[1] = p.arr[1]; out[2] = p.arr[2]; return; }
  if (d >= p.total) { const i = (p.n - 1) * 3; out[0] = p.arr[i]; out[1] = p.arr[i + 1]; out[2] = p.arr[i + 2]; return; }
  let lo = 0, hi = p.n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p.cum[m] < d) lo = m; else hi = m; }
  const t = (d - p.cum[lo]) / Math.max(1e-6, p.cum[hi] - p.cum[lo]), a = lo * 3, b = hi * 3;
  out[0] = p.arr[a] + (p.arr[b] - p.arr[a]) * t; out[1] = p.arr[a + 1] + (p.arr[b + 1] - p.arr[a + 1]) * t; out[2] = p.arr[a + 2] + (p.arr[b + 2] - p.arr[a + 2]) * t;
}

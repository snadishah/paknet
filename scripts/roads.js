// Bakes Pakistan's motorways and national highways from OpenStreetMap and snaps
// every domestic fibre corridor to the road it follows (M-2, M-9, N-5, N-25,
// N-35/KKH …). Output: src/data/roads.json
//   { lines: [[lon, lat, lon, lat, …], …]   all M/N roads (for the map overlay)
//     corridors: { "Karachi|Hyderabad": [lon, lat, …], … } }   one road path per fibre corridor
//   npm run roads   (scripts/fetch-roads.mjs bundles this file with esbuild, then runs it)
// Data © OpenStreetMap contributors (ODbL). Render-only: the simulator keeps its
// own straight-line lengths and delays; only the drawing follows the roads.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTopology } from '../src/graph/topology.js';

const root = process.cwd(); // fetch-roads.mjs runs it from the repo root
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
// the whole main road network (complete and joined at junctions; the M-/N- route relations have gaps)
const Q = `[out:json][timeout:300];area["ISO3166-1"="PK"][admin_level=2]->.pk;
way["highway"~"^(motorway|trunk|primary)$"](area.pk);out tags geom;`;
const SNAP_KM = 25, MAX_DETOUR = 2.4, TOL_CORRIDOR = 0.0004, TOL_LINES = 0.0025; // detour: mountain roads wind (KKH); tolerances in degrees (~40 m / ~280 m)

async function overpass(q) {
  for (const url of ENDPOINTS) {
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'paknet-student-project (build-time snapshot)' } });
      if (r.ok) return await r.json(); console.warn(`${url}: HTTP ${r.status}`);
    } catch (e) { console.warn(`${url}: ${e.message}`); }
  }
  throw new Error('all Overpass endpoints failed');
}
const D = Math.PI / 180;
const km = (a, b) => { const x = (b[0] - a[0]) * Math.cos((a[1] + b[1]) / 2 * D), y = b[1] - a[1]; return Math.hypot(x, y) * 111.2; };
function dp(pts, tol) { // Douglas–Peucker on [lon, lat]
  if (pts.length < 3) return pts; const a = pts[0], b = pts[pts.length - 1]; let idx = -1, dmax = 0;
  for (let i = 1; i < pts.length - 1; i++) { const p = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-12; const d = Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / L; if (d > dmax) { dmax = d; idx = i; } }
  return dmax <= tol ? [a, b] : [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)];
}
const flat = pts => pts.flatMap(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]);

// the raw download is cached (node_modules/.cache) so re-running doesn't hit the public server; --refresh re-downloads
const CACHE = join(root, 'node_modules/.cache/osm-roads-raw.json');
let data;
if (existsSync(CACHE) && !process.argv.includes('--refresh')) data = JSON.parse(readFileSync(CACHE, 'utf8'));
else {
  for (let i = 0; i < 6 && !data; i++) { try { data = await overpass(Q); } catch (e) { console.warn(`try ${i + 1}: ${e.message}; waiting 60 s`); await new Promise(r => setTimeout(r, 60000)); } }
  if (!data) throw new Error('Overpass unavailable; the previous src/data/roads.json is kept');
  writeFileSync(CACHE, JSON.stringify(data));
}
const ways = data.elements.filter(e => e.type === 'way' && e.geometry);
console.log(`OSM: ${ways.length} motorway/trunk/primary ways`);

// road graph: vertices are OSM nodes (shared at junctions), edges along each way
const key = p => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
const V = new Map(), adj = [];
const vid = p => { const k = key(p); let i = V.get(k); if (i == null) { i = adj.length; V.set(k, i); adj.push([]); coords.push(p); } return i; };
const coords = [];
for (const w of ways) { const pts = w.geometry.map(g => [g.lon, g.lat]); for (let i = 1; i < pts.length; i++) { const a = vid(pts[i - 1]), b = vid(pts[i]), d = km(pts[i - 1], pts[i]); adj[a].push([b, d]); adj[b].push([a, d]); } }
// a coarse grid to find the nearest road vertex
const grid = new Map(), cell = p => `${Math.floor(p[0] * 4)},${Math.floor(p[1] * 4)}`;
coords.forEach((p, i) => { const k = cell(p); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
function nearest(p) { let best = -1, bd = Infinity; const [cx, cy] = [Math.floor(p[0] * 4), Math.floor(p[1] * 4)]; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const i of grid.get(`${cx + dx},${cy + dy}`) || []) { const d = km(p, coords[i]); if (d < bd) { bd = d; best = i; } } return [best, bd]; }
function dijkstra(s, t) { // binary-heap Dijkstra on the road graph
  const dist = new Float64Array(adj.length).fill(Infinity), prev = new Int32Array(adj.length).fill(-1), heap = [[0, s]]; dist[s] = 0;
  const push = x => { heap.push(x); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) { const [d, u] = pop(); if (u === t) break; if (d > dist[u]) continue; for (const [v, w] of adj[u]) { const nd = d + w; if (nd < dist[v]) { dist[v] = nd; prev[v] = u; push([nd, v]); } } }
  if (dist[t] === Infinity) return null; const path = []; for (let u = t; u !== -1; u = prev[u]) path.push(coords[u]); return { km: dist[t], pts: path.reverse() };
}

// fibre corridors between cities (the same edges the map draws as fibre / aerial fibre)
const G = buildTopology();
const corridors = {}; let ok = 0, skipped = [];
for (const e of G.edges.filter(e => e.type === 'fiber' || e.type === 'aerial')) {
  const A = G.nodes[e.a], B = G.nodes[e.b]; if (A.lon == null || B.lon == null) continue;
  const pa = [A.lon, A.lat], pb = [B.lon, B.lat], [sa, da] = nearest(pa), [sb, db] = nearest(pb), straight = km(pa, pb);
  if (sa < 0 || sb < 0 || da > SNAP_KM || db > SNAP_KM) { skipped.push(`${A.name}–${B.name} (no road near)`); continue; }
  const r = dijkstra(sa, sb);
  if (!r || r.km > straight * MAX_DETOUR + 20) { skipped.push(`${A.name}–${B.name} (${r ? Math.round(r.km) + ' km by road vs ' + Math.round(straight) : 'not connected'})`); continue; }
  // the city centre → road → road → city centre, simplified to ~40 m
  corridors[`${A.name}|${B.name}`] = flat(dp([pa, ...r.pts, pb], TOL_CORRIDOR)); ok++;
}
const lines = ways.filter(w => /^(motorway|trunk)$/.test(w.tags?.highway)).map(w => flat(dp(w.geometry.map(g => [g.lon, g.lat]), TOL_LINES))).filter(l => l.length >= 4);
mkdirSync(join(root, 'src/data'), { recursive: true });
const out = JSON.stringify({ source: '© OpenStreetMap contributors (ODbL), via Overpass API', fetched: new Date().toISOString(), lines, corridors });
writeFileSync(join(root, 'src/data/roads.json'), out);
console.log(`corridors on roads: ${ok}; kept straight: ${skipped.length}${skipped.length ? ' → ' + skipped.join('; ') : ''}`);
console.log(`saved src/data/roads.json (${(out.length / 1024).toFixed(0)} KB)`);

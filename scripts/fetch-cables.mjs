// Bakes the real routes of Pakistan's submarine cables, from Karachi to a real
// landing point abroad, for each direction the simulator uses (W, E, SW), plus G: the same
// westbound cable stopping in the Gulf (UAE / Oman), for traffic that ends there (WhatsApp to Dubai).
// Output: src/data/cables.json
//   { source, credit, cables: { AAE1: { name, approx?, routes: { W: [lon, lat, …], E: […] },
//                                        dest: { W: { name, lon, lat }, … } }, … } }
//   npm run cables   (--refresh re-downloads)
// Data: TeleGeography submarine cable map, public API v2 as published in 2021
// (mirrored at github.com/kmdrn7/cablemap-gis), CC BY-NC-SA 3.0. SEA-ME-WE 6
// (2025) is not in it: drawn along SEA-ME-WE 5's path and marked approximate; 2Africa's Pakistan
// branch (2025) isn't either: joined from Karachi to the nearest point of 2Africa, also marked approximate.
// Render-only: the simulator keeps its own cable lengths and delays.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://raw.githubusercontent.com/kmdrn7/cablemap-gis/HEAD/docs/api/v2';
const SOURCE = 'TeleGeography submarine cable map, public API v2 (2021 snapshot, mirrored at github.com/kmdrn7/cablemap-gis)';
const CREDIT = 'Submarine cable routes © TeleGeography, submarinecablemap.com (CC BY-NC-SA 3.0)';
// simulator id → TeleGeography slug, and the directions the simulator gives each cable (src/graph/topology.js)
const CABLES = {
  SMW4: ['seamewe-4', ['W', 'E']], IMEWE: ['imewe', ['W', 'E']], AAE1: ['asia-africa-europe-1-aae-1', ['W', 'E']],
  AFR1: ['africa-1', ['SW']], SMW5: ['seamewe-5', ['W', 'E']], TW1: ['transworld-tw1', ['W']],
  SMW6: ['seamewe-5', ['W', 'E'], 'Route not yet in the open data: drawn along SEA-ME-WE 5, which follows nearly the same path'],
  '2AFR': ['2africa', ['SW'], "Pakistan branch not yet in the open data: joined from Karachi to 2Africa's nearest point"], PEACE: ['peace-cable', ['SW']], SMW3: ['seamewe-3', ['W']]
};
// where each direction goes: the first country on the list that the cable lands in, else the farthest landing that way
const PREFER = { G: ['United Arab Emirates', 'Oman', 'Qatar', 'Saudi Arabia'], W: ['France', 'Italy', 'Portugal', 'Spain', 'Egypt'], E: ['Singapore', 'China' /* Hong Kong is listed as China */, 'Malaysia'], SW: ['Kenya', 'Djibouti', 'Egypt'] };
const FARTHEST = { G: null, W: p => -p.lon, E: p => p.lon, SW: p => -p.lat };

const CACHE = join(root, 'node_modules/.cache/cables-raw');
mkdirSync(CACHE, { recursive: true });
async function get(path) {
  const f = join(CACHE, path.replace(/\//g, '_'));
  if (existsSync(f) && !process.argv.includes('--refresh')) return JSON.parse(readFileSync(f, 'utf8'));
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(`${BASE}/${path}`); if (!r.ok) throw new Error(`HTTP ${r.status}`); const t = await r.text(); writeFileSync(f, t); return JSON.parse(t); }
    catch (e) { console.warn(`${path}: ${e.message}${i < 2 ? ', retrying' : ''}`); await new Promise(r => setTimeout(r, 2000 * (i + 1))); }
  }
  throw new Error(`could not download ${path}`);
}

const D = Math.PI / 180;
const gcDist = (p, q) => km([p.lon, p.lat], [q.lon, q.lat]);
const km = (a, b) => { const s = Math.sin((b[1] - a[1]) * D / 2) ** 2 + Math.cos(a[1] * D) * Math.cos(b[1] * D) * Math.sin((b[0] - a[0]) * D / 2) ** 2; return 12742 * Math.asin(Math.min(1, Math.sqrt(s))); };
function dp(pts, tol) { // Douglas–Peucker on [lon, lat]
  if (pts.length < 3) return pts; const a = pts[0], b = pts[pts.length - 1]; let idx = -1, dmax = 0;
  for (let i = 1; i < pts.length - 1; i++) { const p = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-12; const d = Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / L; if (d > dmax) { dmax = d; idx = i; } }
  return dmax <= tol ? [a, b] : [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)];
}

// The cable as a graph: route vertices (joined when closer than 3 km), edges along each line.
function graph(lines) {
  const V = [], adj = [];
  const vid = p => { for (let i = 0; i < V.length; i++) if (km(V[i], p) < 3) return i; V.push(p); adj.push([]); return V.length - 1; };
  for (const line of lines) for (let i = 1; i < line.length; i++) { const a = vid(line[i - 1]), b = vid(line[i]); if (a !== b) { const w = km(V[a], V[b]); adj[a].push([b, w]); adj[b].push([a, w]); } }
  return { V, adj };
}
function nearest(V, p) { let best = -1, d = Infinity; V.forEach((v, i) => { const x = km(v, p); if (x < d) { d = x; best = i; } }); return [best, d]; }
function shortest({ V, adj }, s, t) { // Dijkstra (the graphs are a few hundred vertices)
  const dist = new Float64Array(V.length).fill(Infinity), prev = new Int32Array(V.length).fill(-1), done = new Uint8Array(V.length); dist[s] = 0;
  for (;;) { let u = -1; for (let i = 0; i < V.length; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i; if (u < 0 || dist[u] === Infinity || u === t) break; done[u] = 1; for (const [v, w] of adj[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; } }
  if (dist[t] === Infinity) return null; const path = []; for (let u = t; u >= 0; u = prev[u]) path.unshift(V[u]); return { path, km: dist[t] };
}

const geo = await get('cable/cable-geo.json');
const out = { source: SOURCE, credit: CREDIT, cables: {} };
for (const [id, [slug, dirs, approx]] of Object.entries(CABLES)) {
  const feat = geo.features.find(f => f.properties.slug === slug); if (!feat) { console.warn(`${id}: ${slug} not in the data`); continue; }
  const info = await get(`cable/${slug}.json`);
  const lands = info.landing_points.map(l => { const [lat, lon] = l.latlon.split(',').map(Number); return { name: l.name, country: l.name.split(', ').pop(), lon, lat }; });
  const G = graph(feat.geometry.coordinates);
  const home = lands.find(l => /Karachi/.test(l.name)) || (approx && { name: 'Karachi, Pakistan', country: 'Pakistan', lon: 66.98, lat: 24.8 }); if (!home) { console.warn(`${id}: no Karachi landing`); continue; }
  const [s, sd] = nearest(G.V, [home.lon, home.lat]);
  const c = out.cables[id] = { name: info.name.replace(/\s*\(.*\)$/, '') || info.name, routes: {}, dest: {} };
  if (approx) c.approx = approx;
  for (const d of dirs.includes('W') ? [...dirs, 'G'] : dirs) {
    const pool = lands.filter(l => l !== home && (d !== 'E' || l.lon > home.lon) && (d === 'E' || l.lon < home.lon + 1));
    const far = FARTHEST[d] || (p => -gcDist(p, home)); // the Gulf: the nearest landing there
    const dest = PREFER[d].map(n => pool.filter(l => l.country === n).sort((a, b) => far(b) - far(a))[0]).find(Boolean) || (FARTHEST[d] && pool.sort((a, b) => far(b) - far(a))[0]);
    if (!dest) { console.warn(`${id} ${d}: no landing that way`); continue; }
    const [t, td] = nearest(G.V, [dest.lon, dest.lat]); const r = shortest(G, s, t);
    if (!r) { console.warn(`${id} ${d}: no route to ${dest.name}`); continue; }
    const pts = dp([[home.lon, home.lat], ...r.path, [dest.lon, dest.lat]], 0.02);
    c.routes[d] = pts.flatMap(([x, y]) => [Math.round(x * 1e3) / 1e3, Math.round(y * 1e3) / 1e3]);
    c.dest[d] = { name: dest.name.replace(/^Cape D.Aguilar, China$/, 'Hong Kong'), lon: dest.lon, lat: dest.lat }; // the data lists Hong Kong under China
    console.log(`${id.padEnd(5)} ${d.padEnd(2)} → ${dest.name} (${Math.round(r.km + sd + td)} km, ${pts.length} points)`);
  }
}
const f = join(root, 'src/data/cables.json');
writeFileSync(f, JSON.stringify(out));
console.log(`wrote src/data/cables.json (${Math.round(readFileSync(f).length / 1024)} KB)`);

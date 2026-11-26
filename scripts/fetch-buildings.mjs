// Fetches OpenStreetMap building footprints around each illustrative office
// (Overpass API) and bakes them into src/data/cities/<city>.json in a local
// East-North-Up frame (metres, origin = the office), with a height per building.
//   npm run buildings
// Data © OpenStreetMap contributors, ODbL. Keeps each file < 300 KB; a city
// whose request fails keeps its previous file.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OFFICES } from '../src/sim/offices.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'src/data/cities');
const RADIUS = 560, MAX_BUILDINGS = 2200, MAX_BYTES = 290 * 1024;
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
mkdirSync(outDir, { recursive: true });

// Heights: the height tag, else building:levels × 3.2 m, else a stable guess from the footprint size.
function heightOf(tags, area, id) {
  const h = parseFloat(tags.height); if (h > 2 && h < 400) return h;
  const lv = parseFloat(tags['building:levels']); if (lv > 0 && lv < 100) return lv * 3.2 + 1;
  const r = ((id * 2654435761) >>> 0) / 4294967296; // deterministic per building
  return area > 2500 ? 12 + r * 14 : area > 600 ? 8 + r * 8 : 4.5 + r * 5;
}
const areaOf = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
// Douglas–Peucker-lite: drop points closer than 0.8 m to the line through their neighbours.
function simplify(pts) {
  if (pts.length <= 8) return pts;
  return pts.filter((p, i) => { if (i === 0) return true; const a = pts[i - 1], b = pts[(i + 1) % pts.length]; const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / L > 0.8; });
}

async function overpass(q) {
  for (const url of ENDPOINTS) {
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'paknet-student-project (build-time snapshot)' } });
      if (r.ok) return await r.json();
      console.warn(`  ${url}: HTTP ${r.status}`);
    } catch (e) { console.warn(`  ${url}: ${e.message}`); }
  }
  throw new Error('all Overpass endpoints failed');
}

const only = process.argv.slice(2); // e.g. `npm run buildings -- peshawar` re-fetches one city
for (const o of OFFICES) {
  if (only.length && !only.includes(o.key)) continue;
  const file = join(outDir, `${o.key}.json`);
  try {
    const rad = o.key === 'quetta' ? 900 : RADIUS; // Quetta's centre is sparsely mapped in OSM
    const q = `[out:json][timeout:90];(way["building"](around:${rad},${o.lat},${o.lon}););out geom tags;`;
    const data = await overpass(q);
    const kx = Math.cos(o.lat * Math.PI / 180) * 111320, ky = 110540;
    let bs = [];
    for (const w of data.elements || []) {
      if (!w.geometry || w.geometry.length < 4) continue;
      let pts = w.geometry.map(g => [(g.lon - o.lon) * kx, (g.lat - o.lat) * ky]);
      if (pts.length > 1 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop();
      pts = simplify(pts); if (pts.length < 3) continue;
      let A = areaOf(pts); if (Math.abs(A) < 12) continue;
      if (A < 0) { pts.reverse(); A = -A; } // counter-clockwise
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      bs.push({ h: heightOf(w.tags || {}, A, w.id), pts, d: Math.hypot(cx, cy), a: A, id: w.id });
    }
    bs.sort((a, b) => a.d - b.d); bs = bs.slice(0, MAX_BUILDINGS);
    // The office: the biggest building within 120 m of the office point (illustrative choice).
    const near = bs.filter(b => b.d < 120).sort((a, b) => b.a - a.a)[0] || bs[0];
    const pack = list => JSON.stringify({ city: o.city, office: o.name, lat: o.lat, lon: o.lon, radius: rad, source: '© OpenStreetMap contributors (ODbL), via Overpass API', fetched: new Date().toISOString(),
      officeIndex: list.indexOf(near), b: list.map(b => [Math.round(b.h), ...b.pts.flatMap(p => [Math.round(p[0] * 2) / 2, Math.round(p[1] * 2) / 2])]) });
    let json = pack(bs);
    while (json.length > MAX_BYTES && bs.length > 200) { bs = bs.slice(0, Math.floor(bs.length * 0.85)); if (!bs.includes(near)) bs.unshift(near); json = pack(bs); }
    writeFileSync(file, json);
    console.log(`${o.key.padEnd(10)} ${bs.length} buildings, ${(json.length / 1024).toFixed(0)} KB, office building h=${Math.round(near.h)} m`);
    await new Promise(r => setTimeout(r, 2500)); // be gentle with the public server
  } catch (e) {
    console.warn(`${o.key}: ${e.message}${existsSync(file) ? ' — keeping the previous file' : ' — no file'}`);
  }
}

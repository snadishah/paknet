// Fetches OpenStreetMap streets and mapped trees around each illustrative office (Overpass API) and
// bakes them into src/data/cities/<city>-streets.json in the same local frame as the buildings
// (metres east / north of the office). city.js lines the streets with trees, lamps and parked cars.
//   npm run streets [-- karachi]
// Data © OpenStreetMap contributors, ODbL. A city whose request fails keeps its previous file.
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OFFICES } from '../src/sim/offices.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const KIND = { trunk: 0, primary: 0, secondary: 0, tertiary: 1, residential: 1, unclassified: 1, living_street: 1, service: 2 }; // 0 main road, 1 street, 2 lane

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

const only = process.argv.slice(2);
for (const o of OFFICES) {
  if (only.length && !only.includes(o.key)) continue;
  const file = join(root, 'src/data/cities', `${o.key}-streets.json`);
  try {
    // the same radius as the city's buildings file
    const rad = JSON.parse(readFileSync(join(root, 'src/data/cities', `${o.key}.json`), 'utf8')).radius || 560;
    const q = `[out:json][timeout:90];(way["highway"~"^(${Object.keys(KIND).join('|')})$"](around:${rad},${o.lat},${o.lon});node["natural"="tree"](around:${rad},${o.lat},${o.lon}););out geom;`;
    const data = await overpass(q);
    const kx = Math.cos(o.lat * Math.PI / 180) * 111320, ky = 110540, r1 = v => Math.round(v * 2) / 2;
    const s = [], t = [];
    for (const el of data.elements || []) {
      if (el.type === 'node') { t.push([r1((el.lon - o.lon) * kx), r1((el.lat - o.lat) * ky)]); continue; }
      if (!el.geometry || el.geometry.length < 2) continue;
      s.push([KIND[el.tags?.highway] ?? 1, ...el.geometry.flatMap(g => [r1((g.lon - o.lon) * kx), r1((g.lat - o.lat) * ky)])]);
    }
    const json = JSON.stringify({ city: o.city, source: '© OpenStreetMap contributors (ODbL), via Overpass API', fetched: new Date().toISOString(), s, t });
    writeFileSync(file, json);
    console.log(`${o.key.padEnd(10)} ${s.length} streets, ${t.length} trees, ${(json.length / 1024).toFixed(0)} KB`);
    await new Promise(r => setTimeout(r, 2500)); // be gentle with the public server
  } catch (e) {
    console.warn(`${o.key}: ${e.message}${existsSync(file) ? ' — keeping the previous file' : ' — no file'}`);
  }
}

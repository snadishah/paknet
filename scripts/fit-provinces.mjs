// Fit the 6 coarse province polygons to the detailed Natural Earth 10 m outline
// of Pakistan (docs/PLAN.md step 9).
//
//   node scripts/fit-provinces.mjs            → writes data/prov_fitted.json
//   node scripts/fit-provinces.mjs --inspect  → only prints how the two datasets differ
//
// Method (no buffering needed):
//   1. clip each province to the detailed outline (removes overshoot into the sea
//      or across borders)
//   2. the slivers of the detailed outline that no province covers (the coast's
//      inlets and capes, border wiggles) are each given to the province whose
//      boundary is nearest
// The provinces then tile the detailed outline exactly, and internal borders
// stay where the coarse data put them.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'polygon-clipping';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = JSON.parse(readFileSync(join(root, 'data/countries.json')));
const P = JSON.parse(readFileSync(join(root, 'data/prov_merged.json')));
const PAK = C.PAK;
if (!PAK) throw new Error('data/countries.json has no PAK outline');

// signed-area helpers (degrees², fine for comparisons)
const ringArea = r => { let x = 0; for (let k = 0; k < r.length - 1; k++) x += r[k][0] * r[k + 1][1] - r[k + 1][0] * r[k][1]; return Math.abs(x) / 2; };
const area = mp => mp.reduce((s, poly) => s + poly.reduce((a, ring, i) => a + (i ? -1 : 1) * ringArea(ring), 0), 0);
const points = mp => mp.reduce((s, p) => s + p.reduce((a, r) => a + r.length, 0), 0);
const centroid = poly => { const r = poly[0]; let x = 0, y = 0; for (const [a, b] of r) { x += a; y += b; } return [x / r.length, y / r.length]; };
// distance from a point to the nearest edge of a multipolygon
function distTo(mp, [px, py]) {
  let best = Infinity;
  for (const poly of mp) for (const ring of poly) for (let i = 0; i < ring.length - 1; i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[i + 1], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return best;
}

const U = pc.union(...Object.values(P));
const report = {
  pakArea: area(PAK), provincesArea: area(U),
  pakNotInProvinces: area(pc.difference(PAK, U)), provincesOutsidePak: area(pc.difference(U, PAK)),
  perProvinceOutside: Object.fromEntries(Object.entries(P).map(([k, v]) => [k, +area(pc.difference(v, PAK)).toFixed(3)]))
};
console.log('detailed outline:', PAK.length, 'polygons,', points(PAK), 'points; provinces:', points(U), 'points');
console.log(JSON.stringify(report, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v), 2));
if (process.argv.includes('--inspect')) process.exit(0);

// 1. clip
const fitted = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, pc.intersection(v, PAK)]));
// 2. hand out the uncovered slivers
const gaps = pc.difference(PAK, U);
const tally = Object.fromEntries(Object.keys(P).map(k => [k, 0]));
for (const g of gaps) {
  const c = centroid(g);
  let bestK = null, bestD = Infinity;
  for (const [k, v] of Object.entries(fitted)) { const d = distTo(v, c); if (d < bestD) { bestD = d; bestK = k; } }
  fitted[bestK] = pc.union(fitted[bestK], [g]); tally[bestK] += area([g]);
}
// round coordinates to 4 decimals (~11 m) to keep the file small
const round = mp => mp.map(poly => poly.map(ring => ring.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)])));
for (const k in fitted) fitted[k] = round(fitted[k]);

const after = pc.union(...Object.values(fitted));
console.log('slivers assigned (deg²):', Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, +v.toFixed(3)])));
console.log('fitted points per province:', Object.fromEntries(Object.entries(fitted).map(([k, v]) => [k, points(v)])));
console.log('check: fitted union vs outline, area difference (deg²):', +Math.abs(area(after) - area(PAK)).toFixed(4));
writeFileSync(join(root, 'data/prov_fitted.json'), JSON.stringify(fitted));
console.log('wrote data/prov_fitted.json');

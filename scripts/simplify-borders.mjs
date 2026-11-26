// Makes src/data/borders.json: the neighbouring countries' outer rings from
// data/countries.json (Natural Earth 10 m), simplified to ~1 km and rounded to
// 3 decimals. The globe only draws them as faint lines, so the full detail isn't needed.
//   node scripts/simplify-borders.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = JSON.parse(readFileSync(join(root, 'data/countries.json'), 'utf8'));
const KEYS = ['IND', 'AFG', 'IRN', 'CHN', 'OMN', 'TJK', 'ARE'];
const TOL = 0.01; // degrees (~1 km)

// Douglas–Peucker on [lon, lat] points
function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]]; let idx = -1, dmax = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-12;
    const d = Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / L; if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax <= tol) return [a, b];
  return [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)];
}
const out = {}; let before = 0, after = 0;
for (const k of KEYS) {
  if (!C[k]) continue;
  // closed rings: simplify the two halves separately (first point = last point would collapse a single pass)
  out[k] = C[k].map(poly => { const r = poly[0]; before += r.length; const h = Math.floor(r.length / 2); const s = [...dp(r.slice(0, h + 1), TOL).slice(0, -1), ...dp(r.slice(h), TOL)].map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]); after += s.length; return [s]; }).filter(p => p[0].length >= 4);
}
mkdirSync(join(root, 'src/data'), { recursive: true });
const json = JSON.stringify(out); writeFileSync(join(root, 'src/data/borders.json'), json);
console.log(`borders: ${before} → ${after} points, ${(json.length / 1024).toFixed(0)} KB`);

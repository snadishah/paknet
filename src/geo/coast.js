// Province outlines and helpers that work on them.
// prov_fitted.json: the 6 provinces fitted to the detailed Natural Earth 10 m
// outline of Pakistan (scripts/fit-provinces.mjs); prov_merged.json is the coarse source.
import PROV from '../../data/prov_fitted.json';
import { P, unP } from './projection.js';

export { PROV };

// Nearest point on a province boundary (puts landing stations on the coast).
export function snapToCoast(prov, lon, lat) {
  const q = P(lon, lat); let best = null, bd = 1e9;
  for (const ring of PROV[prov].map(p => p[0])) for (let i = 0; i < ring.length - 1; i++) {
    const a = P(...ring[i]), b = P(...ring[i + 1]); const ab = b.clone().sub(a);
    const t = Math.max(0, Math.min(1, q.clone().sub(a).dot(ab) / ab.lengthSq()));
    const c = a.clone().addScaledVector(ab, t); const d = c.distanceTo(q); if (d < bd) { bd = d; best = c; }
  }
  return unP(best);
}

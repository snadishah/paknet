// SGP4 propagation with satellite.js. Pure (no three.js, no DOM), used by the
// worker and by the tests. Positions are Earth-fixed (ECEF) km, the same frame
// as the globe (geo/globe.js).
import { json2satrec, propagate, gstime, eciToEcf, eciToGeodetic, degreesLong, degreesLat } from 'satellite.js';

// OMM objects → satrecs. Records that fail to parse are kept as null (skipped later).
export function makeRecords(omms) { return omms.map(o => { try { const r = json2satrec(o); return r && !r.error ? r : null; } catch { return null; } }); }

// ECEF km of one satellite at a Date, or null (decayed / bad elements).
export function ecefAt(rec, date, gmst = gstime(date)) {
  if (!rec) return null;
  const pv = propagate(rec, date);
  if (!pv || !pv.position || typeof pv.position === 'boolean' || !Number.isFinite(pv.position.x)) return null;
  const p = eciToEcf(pv.position, gmst); return [p.x, p.y, p.z];
}

// Fill out (Float32Array, 3 per satellite) with ECEF km; failed ones get NaN.
export function positionsAt(recs, date, out) {
  const g = gstime(date);
  for (let i = 0; i < recs.length; i++) {
    const p = ecefAt(recs[i], date, g);
    if (p) { out[i * 3] = p[0]; out[i * 3 + 1] = p[1]; out[i * 3 + 2] = p[2]; } else out[i * 3] = out[i * 3 + 1] = out[i * 3 + 2] = NaN;
  }
  return out;
}

// { lat, lon, alt } of one satellite at a Date (for info cards and tests).
export function geodeticAt(rec, date) {
  const pv = rec && propagate(rec, date); if (!pv || !pv.position || typeof pv.position === 'boolean') return null;
  const g = eciToGeodetic(pv.position, gstime(date));
  return { lat: degreesLat(g.latitude), lon: degreesLong(g.longitude), alt: g.height };
}

// One orbit as ECEF points, drawn "frozen" at the given time (the orbit ring as
// seen in space right now, not the ground track). n points over one period.
export function orbitRing(rec, date, n = 96) {
  if (!rec) return [];
  const periodMin = (2 * Math.PI) / rec.no; // rec.no is rad/min
  const g = gstime(date), pts = [];
  for (let i = 0; i <= n; i++) {
    const d = new Date(date.getTime() + (i / n) * periodMin * 60000), pv = propagate(rec, d);
    if (!pv || !pv.position || typeof pv.position === 'boolean') continue;
    const p = eciToEcf(pv.position, g); pts.push([p.x, p.y, p.z]);
  }
  return pts;
}

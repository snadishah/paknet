// Globe geometry, pure (no three.js, no DOM). Units: kilometres and degrees.
// The Earth is a sphere of radius R. ECEF axes: +X towards 0°N 0°E,
// +Y towards 0°N 90°E, +Z towards the North Pole.
// Local views use East-North-Up (ENU) frames in metres centred on a place.
// Same constants as projection.js (kept here so this module doesn't import three.js).
const LON0 = 69.3, LAT0 = 30.2, KX = Math.cos(LAT0 * Math.PI / 180), KM_PER_UNIT = 111;

export const R = 6371;
export const GEO_ALT = 35786; // geostationary altitude, km
const D = Math.PI / 180;

// [x, y, z] in km. out (optional array) is filled and returned, to avoid allocations.
export function latLonToEcef(lat, lon, altKm = 0, out = [0, 0, 0]) {
  const r = R + altKm, cl = Math.cos(lat * D);
  out[0] = r * cl * Math.cos(lon * D); out[1] = r * cl * Math.sin(lon * D); out[2] = r * Math.sin(lat * D);
  return out;
}

// { lat, lon, alt } from ECEF km.
export function ecefToLatLon(x, y, z) {
  const r = Math.hypot(x, y, z);
  return { lat: Math.asin(z / r) / D, lon: Math.atan2(y, x) / D, alt: r - R };
}

// Unit vectors of the ENU frame at (lat, lon): { e, n, u }, each [x, y, z].
export function enuBasis(lat, lon) {
  const sl = Math.sin(lat * D), cl = Math.cos(lat * D), so = Math.sin(lon * D), co = Math.cos(lon * D);
  return { e: [-so, co, 0], n: [-sl * co, -sl * so, cl], u: [cl * co, cl * so, sl] };
}

// ECEF point (km) → ENU metres relative to the origin (lat0, lon0, alt 0).
export function ecefToEnu(p, lat0, lon0) {
  const o = latLonToEcef(lat0, lon0, 0), { e, n, u } = enuBasis(lat0, lon0);
  const d = [(p[0] - o[0]) * 1000, (p[1] - o[1]) * 1000, (p[2] - o[2]) * 1000];
  const dot = (a) => a[0] * d[0] + a[1] * d[1] + a[2] * d[2];
  return [dot(e), dot(n), dot(u)];
}

// ENU metres → ECEF km.
export function enuToEcef(enu, lat0, lon0) {
  const o = latLonToEcef(lat0, lon0, 0), { e, n, u } = enuBasis(lat0, lon0);
  const m = i => (e[i] * enu[0] + n[i] * enu[1] + u[i] * enu[2]) / 1000;
  return [o[0] + m(0), o[1] + m(1), o[2] + m(2)];
}

// ENU metres → { lat, lon, alt (km) }.
export function enuToLatLon(enu, lat0, lon0) { const p = enuToEcef(enu, lat0, lon0); return ecefToLatLon(p[0], p[1], p[2]); }

// The simulator's flat map plane (projection.js) → lat/lon. z is kept as is.
export const flatToLatLon = (x, y) => ({ lon: x / KX + LON0, lat: y + LAT0 });
export const latLonToFlat = (lat, lon) => ({ x: (lon - LON0) * KX, y: lat - LAT0 });
export { KM_PER_UNIT };

// Great-circle distance in km.
export function gcDistance(lat1, lon1, lat2, lon2) {
  const a = Math.sin((lat2 - lat1) * D / 2) ** 2 + Math.cos(lat1 * D) * Math.cos(lat2 * D) * Math.sin((lon2 - lon1) * D / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// n+1 points [lat, lon] along the great circle from a to b (slerp).
export function greatCircle(lat1, lon1, lat2, lon2, n = 32) {
  const a = latLonToEcef(lat1, lon1, 0).map(v => v / R), b = latLonToEcef(lat2, lon2, 0).map(v => v / R);
  const w = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = Math.sin(w);
    const ka = w < 1e-9 ? 1 - t : Math.sin((1 - t) * w) / s, kb = w < 1e-9 ? t : Math.sin(t * w) / s;
    const p = [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
    const ll = ecefToLatLon(p[0] * R, p[1] * R, p[2] * R); out.push([ll.lat, ll.lon]);
  }
  return out;
}

// Sub-solar point for a UTC date (low-precision solar position, ±0.5°): { lat, lon }.
export function subSolarPoint(date) {
  const jd = date.getTime() / 86400000 + 2440587.5, n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360, g = (357.528 + 0.9856003 * n) % 360;
  const lambda = L + 1.915 * Math.sin(g * D) + 0.02 * Math.sin(2 * g * D), eps = 23.439 - 4e-7 * n;
  const dec = Math.asin(Math.sin(eps * D) * Math.sin(lambda * D)) / D;
  const ra = Math.atan2(Math.cos(eps * D) * Math.sin(lambda * D), Math.cos(lambda * D)) / D;
  const gmst = (280.46061837 + 360.98564736629 * n) % 360;
  let lon = ra - gmst; lon = ((lon + 540) % 360) - 180;
  return { lat: dec, lon };
}

// Distance from the eye to the horizon, km (for culling labels behind the Earth).
export const horizonKm = altKm => Math.sqrt(Math.max(0, (R + altKm) ** 2 - R * R));

// Flat map plane → globe, for drawing. The simulation keeps its flat
// coordinates (edge lengths drive delays); everything drawn goes through here.
import * as THREE from 'three';
import { R, latLonToEcef, flatToLatLon } from '../geo/globe.js';

const a3 = [0, 0, 0];
// Flat (x, y) → ECEF km at altKm. Writes into out (a Vector3) if given.
export function toGlobe(x, y, altKm = 0, out = new THREE.Vector3()) {
  const ll = flatToLatLon(x, y); latLonToEcef(ll.lat, ll.lon, altKm, a3); return out.set(a3[0], a3[1], a3[2]);
}
export const fromLatLon = (lat, lon, altKm = 0, out = new THREE.Vector3()) => { latLonToEcef(lat, lon, altKm, a3); return out.set(a3[0], a3[1], a3[2]); };
// A flat Vector3 (or anything with .x .y) → globe; positions already on the globe (|v| > 1000 km) pass through.
export const G3 = (v, altKm = 0) => (Math.hypot(v.x, v.y, v.z) > 1000 ? v.clone() : toGlobe(v.x, v.y, altKm));

// Densify a flat polyline so each step is ≤ maxStep flat units (~33 km), then map to the globe.
// Straight flat segments become gentle curves that hug the surface.
export function mapPolyline(pts, maxStep = 0.3, altKm = 0) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) {
      const p = pts[i - 1], q = pts[i], n = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / maxStep);
      for (let k = 1; k < n; k++) out.push(toGlobe(p.x + (q.x - p.x) * k / n, p.y + (q.y - p.y) * k / n, altKm));
    }
    out.push(toGlobe(pts[i].x, pts[i].y, altKm));
  }
  return out;
}

// Globe points of an edge, cached on the edge (render-only property).
export function edgeGlobe(e) { return e.gpts || (e.gpts = mapPolyline(e.pts)); }

// A fibre corridor that follows a real road (scripts/roads.js): flat [lon, lat, …] from e.a to e.b.
// Render-only: the simulator's own length and delay for the edge don't change.
export function setRoadGeometry(e, flat) {
  const pts = []; for (let i = 0; i < flat.length; i += 2) pts.push(fromLatLon(flat[i + 1], flat[i]));
  const cum = new Float32Array(pts.length); for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + pts[i].distanceTo(pts[i - 1]);
  e.gpts = pts; e.gcum = cum; e.road = true;
}
// Point at fraction f (0 at e.a, 1 at e.b) along a road edge, into out.
export function sampleRoad(e, f, out) {
  const c = e.gcum, n = c.length, d = Math.max(0, Math.min(1, f)) * c[n - 1];
  let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] < d) lo = m; else hi = m; }
  const t = (d - c[lo]) / Math.max(1e-9, c[hi] - c[lo]); return out.copy(e.gpts[lo]).lerp(e.gpts[hi], t);
}

// Orient an object so its local +Z points away from the Earth's centre at pos.
const Z = new THREE.Vector3(0, 0, 1), n3 = new THREE.Vector3();
export function faceUp(obj, pos) { obj.position.copy(pos); obj.quaternion.setFromUnitVectors(Z, n3.copy(pos).normalize()); return obj; }

export { R };

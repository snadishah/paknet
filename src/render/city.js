// City views: OpenStreetMap buildings around each illustrative office, baked by
// scripts/fetch-buildings.mjs and loaded only when the camera comes down to the
// city. Each city is one merged mesh (calm grey-white) plus the office building
// (highlighted): 2 draw calls. Geometry lives in a local East-North-Up frame in
// metres inside a group placed at the office (scale 0.001 → km), so there is no
// float jitter at 300 m. Everything is disposed when the camera leaves.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { latLonToEcef, enuBasis, gcDistance } from '../geo/globe.js';
import { scene } from './scene.js';
import { pose, altitudeKm } from './globecam.js';

const SHOW_KM = 30, HIDE_KM = 70; // altitude where a city appears / is unloaded
export const cityState = { loaded: {}, failed: {}, onStatus: null };
const groups = {};

function enuGroup(lat, lon) {
  const g = new THREE.Group(), { e, n, u } = enuBasis(lat, lon), o = latLonToEcef(lat, lon, 0);
  g.matrixAutoUpdate = false;
  g.matrix.set(e[0], n[0], u[0], o[0], e[1], n[1], u[1], o[1], e[2], n[2], u[2], o[2], 0, 0, 0, 1)
    .multiply(new THREE.Matrix4().makeScale(0.001, 0.001, 0.001)); // metres → km
  return g;
}

function buildCity(data) {
  const geos = [], office = [];
  data.b.forEach((row, i) => {
    const h = row[0], pts = []; for (let k = 1; k < row.length; k += 2) pts.push(new THREE.Vector2(row[k], row[k + 1]));
    try {
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: h, bevelEnabled: false, curveSegments: 1 });
      g.deleteAttribute('uv'); (i === data.officeIndex ? office : geos).push(g);
    } catch { /* skip a bad footprint */ }
  });
  const g = new THREE.Group();
  const mk = (list, color, emissive) => {
    if (!list.length) return null;
    const merged = mergeGeometries(list); list.forEach(x => x.dispose());
    const m = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color, emissive, transparent: true, opacity: 0 }));
    m.renderOrder = 2; g.add(m); return m;
  };
  g.userData.meshes = [mk(geos, 0xd7dadc, 0x1a1d21), mk(office, 0xf0a35b, 0x3a2410)].filter(Boolean);
  return g;
}

async function load(office) {
  const k = office.key; if (groups[k] || cityState.failed[k]) return;
  groups[k] = { loading: true };
  try {
    const r = await fetch(`assets/cities/${k}.json`); if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    if (!groups[k]?.loading) return; // left while loading
    const g = enuGroup(office.lat, office.lon); g.add(buildCity(data));
    g.userData.office = office; g.userData.shown = performance.now(); g.updateMatrixWorld(true);
    scene.add(g); groups[k] = g; cityState.loaded[k] = data.b.length; cityState.onStatus?.(k, true);
  } catch { delete groups[k]; cityState.failed[k] = true; cityState.onStatus?.(k, false); }
}

function unload(k) {
  const g = groups[k]; if (!g || g.loading) { delete groups[k]; return; }
  scene.remove(g); g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  delete groups[k]; delete cityState.loaded[k];
}

let lastCheck = 0;
export function updateCity(offices) {
  const now = performance.now();
  if (now - lastCheck > 300) {
    lastCheck = now;
    for (const o of offices) {
      const dKm = gcDistance(pose.lat, pose.lon, o.lat, o.lon);
      if (altitudeKm < SHOW_KM && dKm < 40) load(o);
      else if (groups[o.key] && (altitudeKm > HIDE_KM || dKm > 120)) unload(o.key);
    }
  }
  // fade in over 0.8 s, and with altitude between 30 and 15 km
  for (const g of Object.values(groups)) {
    if (!g.children?.[0]?.userData?.meshes) continue; // still loading
    const a = Math.min(1, (now - g.userData.shown) / 800) * (1 - THREE.MathUtils.smoothstep(altitudeKm, 15, SHOW_KM));
    g.visible = a > 0.01;
    // always in the transparent pass, so they draw after the ground tiles (which skip the depth test)
    for (const m of g.children[0].userData.meshes) { m.material.opacity = a; m.material.depthWrite = a > 0.5; }
  }
}
export const cityLoaded = k => !!groups[k]?.children?.[0]?.userData?.meshes;

// PakSat-MM1 up close: the representative model (models/satellite.js) appears when the camera comes
// within a few km of the satellite's live position (satellites.js keeps paksatPos on the orbit), fades
// in, keeps its Earth deck pointed at the Earth and turns its solar wings to face the sun.
import * as THREE from 'three';
import { scene, camera } from './scene.js';
import { paksatPos } from './network.js';
import { globeUniforms } from './globe.js';
import { fadeIn, fadeOut } from './fade3d.js';
import { paksat } from './models/satellite.js';
import { R } from '../geo/globe.js';

let sat = null;
const SHOW_KM = 6, HIDE_KM = 9;
const e = new THREE.Vector3(), n = new THREE.Vector3(), u = new THREE.Vector3(), m = new THREE.Matrix4();
// the inspect pose (globecam): orbit the satellite where it really is (its live position), 45 m away,
// looking down past it so the Earth fills the background
export const PAKSAT_VIEW = () => { const r = paksatPos.length(); return { lat: Math.asin(paksatPos.z / r) * 180 / Math.PI, lon: Math.atan2(paksatPos.y, paksatPos.x) * 180 / Math.PI, alt: r - R, range: 0.05, heading: 15, tilt: 12 }; }; // from GEO the Earth is only ~17° across: a small tilt keeps it behind

export function updatePaksat3d() {
  const d = camera.position.distanceTo(paksatPos);
  if (d < SHOW_KM && !sat) {
    const { body, wings } = paksat(); sat = new THREE.Group(); sat.matrixAutoUpdate = false;
    sat.add(body); wings.forEach(w => sat.add(w)); sat.userData.wings = wings;
    scene.add(sat); fadeIn(sat, 800);
  } else if (d > HIDE_KM && sat) {
    const g = sat; sat = null; fadeOut(g, 500, () => { scene.remove(g); g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); });
  }
  if (!sat) return;
  // local frame at the satellite: u away from the Earth, n north, e east; metres → km
  u.copy(paksatPos).normalize(); n.set(0, 0, 1).sub(u.clone().multiplyScalar(u.z)).normalize(); e.crossVectors(n, u);
  m.makeBasis(e, n, u).setPosition(paksatPos).multiply(new THREE.Matrix4().makeScale(0.001, 0.001, 0.001));
  sat.matrix.copy(m); sat.matrixWorldNeedsUpdate = true;
  // the wings turn about their own axis (north) to face the sun
  const s = globeUniforms.uSun.value, a = Math.atan2(s.dot(e), s.dot(u));
  for (const w of sat.userData.wings) { w.rotation.y = a; w.updateMatrix(); }
}
export const paksatShown = () => !!sat;

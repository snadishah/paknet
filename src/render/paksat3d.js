// PakSat-MM1 in 3D at every distance: the representative model (models/satellite.js) sits at the
// satellite's live position (satellites.js keeps paksatPos on the orbit), keeps its Earth deck pointed at
// the Earth and turns its solar wings to face the sun. A real satellite ~17 m across would be far smaller
// than a pixel from most views, so from afar the same model is drawn enlarged to ~64 px (its label says
// so) and shrinks smoothly to its true size as the camera comes close.
import * as THREE from 'three';
import { scene, camera } from './scene.js';
import { paksatPos } from './network.js';
import { globeUniforms } from './globe.js';
import { fadeIn, fadeOut } from './fade3d.js';
import { paksat } from './models/satellite.js';
import { R } from '../geo/globe.js';

let sat = null, close = false, enlarged = false;
const SHOW_KM = 6, HIDE_KM = 9, SPAN_M = 17, ICON_PX = 64;
const e = new THREE.Vector3(), n = new THREE.Vector3(), u = new THREE.Vector3(), m = new THREE.Matrix4(), sc = new THREE.Matrix4();
// the inspect pose (globecam): orbit the satellite where it really is (its live position), 45 m away,
// looking down past it so the Earth fills the background
export const PAKSAT_VIEW = () => { const r = paksatPos.length(); return { lat: Math.asin(paksatPos.z / r) * 180 / Math.PI, lon: Math.atan2(paksatPos.y, paksatPos.x) * 180 / Math.PI, alt: r - R, range: 0.05, heading: 15, tilt: 12 }; }; // from GEO the Earth is only ~17° across: a small tilt keeps it behind

// on: the satellites are on screen (started, and the "far" layer on). label: its label, told when it is enlarged.
export function updatePaksat3d(on, label) {
  if (on && !sat && paksatPos.lengthSq() > 0) {
    const { body, wings } = paksat(); sat = new THREE.Group(); sat.matrixAutoUpdate = false;
    sat.add(body); wings.forEach(w => sat.add(w)); sat.userData.wings = wings;
    scene.add(sat); fadeIn(sat, 800);
  } else if (!on && sat) {
    const g = sat; sat = null; close = false; fadeOut(g, 500, () => { scene.remove(g); g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); });
  }
  if (!sat) return;
  const d = camera.position.distanceTo(paksatPos);
  close = d < (close ? HIDE_KM : SHOW_KM);
  // enlarge so the model spans at least ICON_PX on screen; 1 = true size
  const px = SPAN_M * 0.001 * innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360) * d), k = Math.max(1, ICON_PX / px);
  if (label && (k > 1.5) !== enlarged) { enlarged = k > 1.5; label.text = label.el.textContent = enlarged ? 'PakSat-MM1 · shown enlarged' : 'PakSat-MM1'; label.w = label.text.length * 7.6 + 16; }
  // local frame at the satellite: u away from the Earth, n north, e east; metres → km
  u.copy(paksatPos).normalize(); n.set(0, 0, 1).sub(u.clone().multiplyScalar(u.z)).normalize(); e.crossVectors(n, u);
  m.makeBasis(e, n, u).setPosition(paksatPos).multiply(sc.makeScale(0.001 * k, 0.001 * k, 0.001 * k));
  sat.matrix.copy(m); sat.matrixWorldNeedsUpdate = true;
  // the wings turn about their own axis (north) to face the sun
  const s = globeUniforms.uSun.value, a = Math.atan2(s.dot(e), s.dot(u));
  for (const w of sat.userData.wings) { w.rotation.y = a; w.updateMatrix(); }
}
export const paksatShown = () => !!sat; // the model is drawn (it replaces the satellite's dot)
export const paksatClose = () => close; // the camera is right next to it (the close-up)

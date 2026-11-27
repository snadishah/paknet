// Pakistan's satellites in 3D at every distance: PakSat-MM1 and the retired PakSat-1R (representative
// models, models/satellite.js), each at its live position (satellites.js), Earth deck pointed at the Earth.
// MM1 turns its solar wings to face the sun; 1R, switched off, has its wings folded and its colours faded.
// A real satellite ~17 m across would be far smaller than a pixel from most views, so from afar each
// model is drawn enlarged to ~64 px (its label says so) and shrinks smoothly to its true size up close.
import * as THREE from 'three';
import { scene, camera } from './scene.js';
import { paksatPos } from './network.js';
import { globeUniforms } from './globe.js';
import { fadeIn, fadeOut } from './fade3d.js';
import { paksat } from './models/satellite.js';
import { R } from '../geo/globe.js';
import { pose, setPose, flying } from './globecam.js';

const SHOW_KM = 6, HIDE_KM = 9, SPAN_M = 17, ICON_PX = 64;
const e = new THREE.Vector3(), n = new THREE.Vector3(), u = new THREE.Vector3(), m = new THREE.Matrix4(), sc = new THREE.Matrix4();
const crafts = {
  mm1: { name: 'PakSat-MM1', retired: false, sat: null, close: false, enlarged: false },
  r1: { name: 'PakSat-1R (retired)', retired: true, sat: null, close: false, enlarged: false }
};
// the inspect pose (globecam): orbit the satellite where it really is (its live position), 45 m away,
// looking down past it so the Earth fills the background
export const PAKSAT_VIEW = () => { const r = paksatPos.length(); return { lat: Math.asin(paksatPos.z / r) * 180 / Math.PI, lon: Math.atan2(paksatPos.y, paksatPos.x) * 180 / Math.PI, alt: r - R, range: 0.05, heading: 15, tilt: 12 }; }; // from GEO the Earth is only ~17° across: a small tilt keeps it behind

// on: the satellites are on screen (started, and the "far" layer on). mm1 / r1: { pos, label } of each.
export function updatePaksat3d(on, mm1, r1) {
  // inspecting PakSat-MM1 (the camera orbits a point in space): that point follows the satellite, whose position
  // can be refined after the camera got there (the orbit data arrives), so it never drifts out of view
  if (pose.alt > 1000 && !flying() && paksatPos.lengthSq() > 0) {
    const la = pose.lat * Math.PI / 180, lo = pose.lon * Math.PI / 180, r = R + pose.alt;
    const d = Math.hypot(r * Math.cos(la) * Math.cos(lo) - paksatPos.x, r * Math.cos(la) * Math.sin(lo) - paksatPos.y, r * Math.sin(la) - paksatPos.z);
    if (d > 0.3 && d < 60) { const v = PAKSAT_VIEW(); setPose({ ...pose, lat: v.lat, lon: v.lon, alt: v.alt }); }
  }
  place(crafts.mm1, on, paksatPos, mm1?.label);
  place(crafts.r1, on && !!r1?.pos, r1?.pos, r1?.label);
}
function place(c, on, pos, label) {
  if (on && !c.sat && pos && pos.lengthSq() > 0) {
    const { body, wings } = paksat({ retired: c.retired }); c.sat = new THREE.Group(); c.sat.matrixAutoUpdate = false;
    c.sat.add(body); wings.forEach(w => c.sat.add(w)); c.sat.userData.wings = wings;
    scene.add(c.sat); fadeIn(c.sat, 800);
  } else if (!on && c.sat) {
    const g = c.sat; c.sat = null; c.close = false; fadeOut(g, 500, () => { scene.remove(g); g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); });
  }
  if (!c.sat) return;
  const d = camera.position.distanceTo(pos);
  c.close = d < (c.close ? HIDE_KM : SHOW_KM);
  // enlarge so the model spans at least ICON_PX on screen; 1 = true size
  const px = SPAN_M * 0.001 * innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360) * d), k = Math.max(1, ICON_PX / px);
  if (label && (k > 1.5) !== c.enlarged) { c.enlarged = k > 1.5; label.text = label.el.textContent = c.enlarged ? `${c.name} · shown enlarged` : c.name; label.mw = 0; } // re-measured by labels.js
  // local frame at the satellite: u away from the Earth, n north, e east; metres → km
  u.copy(pos).normalize(); n.set(0, 0, 1).sub(u.clone().multiplyScalar(u.z)).normalize(); e.crossVectors(n, u);
  m.makeBasis(e, n, u).setPosition(pos).multiply(sc.makeScale(0.001 * k, 0.001 * k, 0.001 * k));
  c.sat.matrix.copy(m); c.sat.matrixWorldNeedsUpdate = true;
  if (c.retired) return; // a switched-off satellite no longer tracks the sun
  // the wings turn about their own axis (north) to face the sun
  const s = globeUniforms.uSun.value, a = Math.atan2(s.dot(e), s.dot(u));
  for (const w of c.sat.userData.wings) { w.rotation.y = a; w.updateMatrix(); }
}
export const paksatShown = () => !!crafts.mm1.sat; // the model is drawn (it replaces the satellite's dot)
export const paksat1RShown = () => !!crafts.r1.sat;
export const paksatClose = () => crafts.mm1.close; // the camera is right next to it (the close-up)

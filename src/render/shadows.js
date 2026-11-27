// Sun shadows close to the ground (docs/ROUND2.md item 11): the sun lamp casts soft shadows from the
// city's buildings and the 3D models onto each other and onto a "shadow catcher" disc lying on the ground
// under the view (the satellite imagery has no lighting of its own, so shadows land on this). Only in
// daylight and below a few km, where shadows are big enough to see; the shadow box follows the view.
import * as THREE from 'three';
import { scene, renderer, sunLight, lightState } from './scene.js';
import { pose, altitudeKm } from './globecam.js';
import { globeUniforms } from './globe.js';
import { latLonToEcef, enuBasis } from '../geo/globe.js';

const MAX_ALT = 3; // km
let catcher = null; const target = new THREE.Vector3(), m4 = new THREE.Matrix4();

export function initShadows() {
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sunLight.shadow.mapSize.set(2048, 2048);
  catcher = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.ShadowMaterial({ opacity: 0.32, depthWrite: false }));
  catcher.receiveShadow = true; catcher.renderOrder = 1; catcher.matrixAutoUpdate = false; catcher.visible = false;
  scene.add(catcher);
}
// Objects that should cast and receive shadows (city blocks, landmark models).
export function shadowsFor(obj) { obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); }

// After the sun has been placed for this frame (shell.frame): aim the shadow box at the ground under the view.
export function updateShadows() {
  if (!catcher) return;
  const a = lightState.day * (1 - THREE.MathUtils.smoothstep(altitudeKm, MAX_ALT * 0.6, MAX_ALT));
  const on = a > 0.05; sunLight.castShadow = on; catcher.visible = on; if (!on) return;
  catcher.material.opacity = 0.32 * a;
  const size = THREE.MathUtils.clamp(pose.range * 1.3, 0.25, 3); // half-width of the shadow box, km
  target.fromArray(latLonToEcef(pose.lat, pose.lon, 0));
  sunLight.target.position.copy(target); sunLight.target.updateMatrixWorld();
  sunLight.position.copy(target).addScaledVector(globeUniforms.uSun.value, 30);
  const c = sunLight.shadow.camera; c.left = c.bottom = -size; c.right = c.top = size; c.near = 1; c.far = 60; c.updateProjectionMatrix();
  sunLight.shadow.bias = -0.0002; sunLight.shadow.normalBias = size / 2048;
  // the catcher: a disc on the ground at the view's centre (0.3 m up so it never fights the imagery)
  const { e, n, u } = enuBasis(pose.lat, pose.lon), r = size * 1.4, o = latLonToEcef(pose.lat, pose.lon, 0.0003);
  m4.set(e[0] * r, n[0] * r, u[0], o[0], e[1] * r, n[1] * r, u[1], o[1], e[2] * r, n[2] * r, u[2], o[2], 0, 0, 0, 1);
  catcher.matrix.copy(m4); catcher.matrixWorldNeedsUpdate = true;
}

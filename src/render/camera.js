// Preset camera views, smooth fly-to and the auto tour.
import * as THREE from 'three';
import { emit } from '../events.js';
import { camera, controls } from './scene.js';

export const VIEWS = {
  overview: { p: [0.4, -19.5, 19], t: [0.4, -2.3, 0] }, top: { p: [0.3, -1.6, 27], t: [0.3, -1.4, 0] },
  karachi: { p: [-1.95, -6.55, 3.1], t: [-1.98, -5.3, 0] }, north: { p: [3.6, 1.4, 4.6], t: [4.3, 4.9, 0] },
  sea: { p: [-1.2, -16.5, 6], t: [-2.3, -7.8, 0] }, sat: { p: [-11, -10, 9], t: [-2.4, 0.4, 1.2] }, cti: { p: [-4.0, -6.6, 5.8], t: [-4.0, -1.0, 0] } // Taftan – Nok Kundi – Dalbandin – Nushki, left of the open panel
};
const TOUR = ['overview', 'karachi', 'sea', 'north', 'top'];

let fly = null;
const tour = { on: false, idx: 0, next: 0 };

// k: a key of VIEWS, or a pose { p: [x,y,z], t: [x,y,z] }
export function flyTo(k, dur = 2200) {
  const v = typeof k === 'string' ? VIEWS[k] : k; if (!v) return;
  fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...v.p), t1: new THREE.Vector3(...v.t), s: performance.now(), dur };
  emit('view:changed', k);
}

export function setTour(on) { tour.on = on; tour.next = 0; }
export const tourOn = () => tour.on;

export function updateCamera() {
  if (fly) {
    const f = Math.min(1, (performance.now() - fly.s) / fly.dur), e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
    camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0, fly.t1, e); if (f >= 1) fly = null;
  }
  if (tour.on && !fly && performance.now() > tour.next) { flyTo(TOUR[tour.idx++ % TOUR.length], 3500); tour.next = performance.now() + 7500; }
  controls.update();
}

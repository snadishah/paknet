// Globe camera: looks at a target point on the Earth from `range` km away, with
// a heading (0 = north up) and a tilt (0 = straight down). One continuous zoom
// from ~60,000 km (GEO satellites in view) down to ~300 m above a city.
// Every programmatic move is an eased fly-to that any user input interrupts.
import * as THREE from 'three';
import { R, latLonToEcef, enuBasis, flatToLatLon, KM_PER_UNIT, gcDistance } from '../geo/globe.js';
import { emit } from '../events.js';
import { camera, renderer, fitClipPlanes } from './scene.js';

export const MIN_RANGE = 0.3, MAX_RANGE = 90000;
const D = Math.PI / 180;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// The current pose. Exported so the shell can read it (deep links, info).
// alt: the height of the point the camera orbits (0 = the ground; PakSat-MM1 = 35,786 km)
export const pose = { lat: 22, lon: 58, range: 24000, heading: 0, tilt: 0, alt: 0 };
// orbiting something in space (the satellite) the camera may come much closer
const minRange = () => (pose.alt > 1000 ? 0.012 : MIN_RANGE);

// Named views (lat, lon, range km, heading, tilt). Old keys kept for scenarios/stories.
export const VIEWS = {
  space: { lat: 22, lon: 60, range: 24000, heading: 0, tilt: 0 },
  overview: { lat: 29.2, lon: 69.4, range: 2700, heading: 0, tilt: 18 },
  pakistan: { lat: 29.2, lon: 69.4, range: 2700, heading: 0, tilt: 18 },
  top: { lat: 30.0, lon: 69.6, range: 3000, heading: 0, tilt: 0 },
  karachi: { lat: 24.9, lon: 67.05, range: 140, heading: 0, tilt: 40 },
  north: { lat: 35.0, lon: 73.9, range: 700, heading: 0, tilt: 38 },
  sea: { lat: 22.8, lon: 63.5, range: 1900, heading: 0, tilt: 28 },
  sat: { lat: 8, lon: 72, range: 84000, heading: 0, tilt: 0 },
  far: { lat: 8, lon: 72, range: 84000, heading: 0, tilt: 0 },
  near: { lat: 26, lon: 66, range: 9000, heading: 0, tilt: 0 },
  cti: { lat: 28.9, lon: 63.6, range: 650, heading: 0, tilt: 32 },
  redsea: { lat: 19.5, lon: 40.5, range: 2800, heading: 0, tilt: 22 },
  gulf: { lat: 23.5, lon: 60.5, range: 2400, heading: 0, tilt: 20 }
};

// Low down you can tilt to the horizon; from mid-space the view is straight down; far out (to see GEO) a tilt is allowed again.
const maxTilt = range => Math.max(78 - 78 * THREE.MathUtils.smoothstep(Math.log(range), Math.log(400), Math.log(9000)), 45 * THREE.MathUtils.smoothstep(Math.log(range), Math.log(15000), Math.log(45000)));

// ---------- pose → camera ----------
const T = new THREE.Vector3(), P = new THREE.Vector3(), U = new THREE.Vector3(), tmpA = [0, 0, 0];
export const target = T;
export let altitudeKm = pose.range;
function apply() {
  pose.tilt = Math.min(pose.tilt, maxTilt(pose.range));
  const { e, n, u } = enuBasis(pose.lat, pose.lon);
  latLonToEcef(pose.lat, pose.lon, pose.alt || 0, tmpA); T.set(tmpA[0], tmpA[1], tmpA[2]);
  const h = pose.heading * D, t = pose.tilt * D;
  // forward (horizontal, where the camera looks) = north rotated by heading
  const f = [n[0] * Math.cos(h) + e[0] * Math.sin(h), n[1] * Math.cos(h) + e[1] * Math.sin(h), n[2] * Math.cos(h) + e[2] * Math.sin(h)];
  const ct = Math.cos(t), st = Math.sin(t);
  P.set(T.x + (u[0] * ct - f[0] * st) * pose.range, T.y + (u[1] * ct - f[1] * st) * pose.range, T.z + (u[2] * ct - f[2] * st) * pose.range);
  U.set(f[0] * ct + u[0] * st, f[1] * ct + u[1] * st, f[2] * ct + u[2] * st);
  camera.position.copy(P); camera.up.copy(U); camera.lookAt(T);
  const dc = P.length(); altitudeKm = dc - R;
  if (pose.alt > 1000) fitClipPlanes(Math.min(altitudeKm, pose.range), dc, 0.0005); // a few metres from the satellite
  else fitClipPlanes(altitudeKm, dc);
}

// ---------- fly-to ----------
let fly = null;
export const flightTarget = () => (fly && !fly.b.alt ? fly.b : null); // where the camera is flying to (tiles and buildings start loading there)
const norm180 = a => ((a + 540) % 360) - 180;
const ease = f => (f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2);

// Turn anything flyTo accepts into a pose.
export function toPose(k) {
  if (typeof k === 'string') return VIEWS[k] ? { alt: 0, ...VIEWS[k] } : null;
  if (!k) return null;
  if ('lat' in k) return { heading: 0, tilt: 0, range: 2000, alt: 0, ...k };
  if (k.p && k.t) { // a pose in the old flat map plane: { p: camera, t: target }
    const t = flatToLatLon(k.t[0], k.t[1]); const dx = k.p[0] - k.t[0], dy = k.p[1] - k.t[1], dz = k.p[2] - (k.t[2] || 0);
    const horiz = Math.hypot(dx, dy), range = Math.hypot(horiz, dz) * KM_PER_UNIT;
    return { lat: t.lat, lon: t.lon, range, heading: horiz > 1e-6 ? norm180(Math.atan2(-dx, -dy) / D) : 0, tilt: Math.atan2(horiz, dz) / D };
  }
  return null;
}

export function flyTo(k, dur) {
  const b = toPose(k); if (!b) return;
  stopFly(); // resolve the move this one replaces, so nobody waits on it forever
  const a = { ...pose };
  const dist = gcDistance(a.lat, a.lon, b.lat, b.lon);
  // long hops rise above both ends, like a plane, so the Earth stays in view
  const peak = Math.max(a.range, b.range, Math.min(MAX_RANGE * 0.5, dist * 1.6));
  dur = dur ?? Math.min(3000, Math.max(1500, 1200 + Math.abs(Math.log(b.range / a.range)) * 180 + dist * 0.12));
  if (reduceMotion) dur = Math.min(dur, 400); // a fade through dark instead of a flight (stepFly)
  goal.lr = goal.lat = goal.lon = goal.heading = null;
  const va = new THREE.Vector3(...latLonToEcef(a.lat, a.lon, 0)).normalize(), vb = new THREE.Vector3(...latLonToEcef(b.lat, b.lon, 0)).normalize();
  // the camera's current motion carries into the new flight and dies away (no stop-and-go jolt)
  fly = { a, b, va, vb, peak, s: performance.now(), dur, dh: norm180(b.heading - a.heading), v0: { ...pv } };
  emit('view:changed', k);
  return new Promise(res => { fly.done = res; });
}
export const flying = () => !!fly;
export function stopFly() { if (fly) { const d = fly.done; fly = null; d?.(); } }

const vtmp = new THREE.Vector3();
function stepFly(now) {
  const f = Math.min(1, (now - fly.s) / fly.dur), { a, b } = fly;
  if (reduceMotion) { veil(1 - Math.abs(2 * f - 1)); if (f >= 0.5) Object.assign(pose, b); if (f >= 1) { veil(0); stopFly(); } return; }
  const e = ease(f);
  // position: slerp between the two surface points
  const w = Math.acos(THREE.MathUtils.clamp(fly.va.dot(fly.vb), -1, 1));
  if (w > 1e-6) { vtmp.copy(fly.va).multiplyScalar(Math.sin((1 - e) * w) / Math.sin(w)).addScaledVector(fly.vb, Math.sin(e * w) / Math.sin(w)); }
  else vtmp.copy(fly.vb);
  pose.lat = Math.asin(THREE.MathUtils.clamp(vtmp.z / vtmp.length(), -1, 1)) / D; pose.lon = Math.atan2(vtmp.y, vtmp.x) / D;
  // range: quadratic Bézier in log space through the peak
  const la = Math.log(a.range), lb = Math.log(b.range), lp = Math.log(fly.peak);
  const lm = 2 * lp - (la + lb) / 2; // control point so the curve reaches lp at the middle
  pose.range = Math.exp((1 - e) * (1 - e) * la + 2 * (1 - e) * e * lm + e * e * lb);
  pose.heading = a.heading + fly.dh * e; pose.tilt = a.tilt + (b.tilt - a.tilt) * e;
  pose.alt = (a.alt || 0) + ((b.alt || 0) - (a.alt || 0)) * e;
  // carried motion: starts at the old speed, gone after ~1 s (v·t·e^(−t/τ) returns to zero)
  const t = now - fly.s, c = t * Math.exp(-t / CARRY_MS), v = fly.v0;
  pose.lat = THREE.MathUtils.clamp(pose.lat + v.lat * c, -85, 85); pose.lon = norm180(pose.lon + v.lon * c);
  pose.range = THREE.MathUtils.clamp(pose.range * Math.exp(v.lr * c), minRange(), MAX_RANGE); pose.heading += v.heading * c; pose.tilt = THREE.MathUtils.clamp(pose.tilt + v.tilt * c, 0, 85);
  if (f >= 1) { Object.assign(pose, b); stopFly(); }
}
const CARRY_MS = 220;
// how the pose is moving right now (per ms), measured every frame
const pv = { lat: 0, lon: 0, lr: 0, heading: 0, tilt: 0 }, last = { ...pose, t: 0 };
function measure(now) {
  const dt = now - last.t;
  if (last.t && dt > 0 && dt < 200) { const k = 0.5; pv.lat += ((pose.lat - last.lat) / dt - pv.lat) * k; pv.lon += (norm180(pose.lon - last.lon) / dt - pv.lon) * k; pv.lr += (Math.log(pose.range / last.range) / dt - pv.lr) * k; pv.heading += (norm180(pose.heading - last.heading) / dt - pv.heading) * k; pv.tilt += ((pose.tilt - last.tilt) / dt - pv.tilt) * k; }
  else pv.lat = pv.lon = pv.lr = pv.heading = pv.tilt = 0;
  Object.assign(last, pose); last.t = now;
}
// reduced motion: the view changes behind a short fade through dark
let veilEl = null;
function veil(o) {
  if (!veilEl) { veilEl = document.createElement('div'); veilEl.style.cssText = 'position:fixed;inset:0;background:#05070a;pointer-events:none;z-index:9;opacity:0'; document.body.appendChild(veilEl); }
  veilEl.style.opacity = o.toFixed(3);
}

// ---------- user input ----------
const el = renderer.domElement;
const vel = { lat: 0, lon: 0 };
// wheel and keys set goals; the camera glides to them (a damped spring, no steps)
const goal = { lr: null, lat: null, lon: null, heading: null };
let drag = null; const pointers = new Map(); let pinch = null;
export const input = { enabled: true, onInteract: null };
function interact() { stopFly(); input.onInteract?.(); }
const kmPerPx = () => 2 * Math.min(pose.range, 30000) * Math.tan(camera.fov * D / 2) / innerHeight;

function panDelta(dx, dy) { // screen pixels → degrees north / east
  const k = kmPerPx() / 111.2, h = pose.heading * D;
  return [(dy * Math.cos(h) + dx * Math.sin(h)) * k, ((-dx * Math.cos(h) + dy * Math.sin(h)) * k) / Math.max(0.2, Math.cos(pose.lat * D))];
}
function panBy(dx, dy) {
  const k = kmPerPx() / 111.2, h = pose.heading * D;
  const north = (dy * Math.cos(h) + dx * Math.sin(h)) * k, east = (-dx * Math.cos(h) + dy * Math.sin(h)) * k;
  pose.lat = THREE.MathUtils.clamp(pose.lat + north, -85, 85);
  pose.lon = norm180(pose.lon + east / Math.max(0.2, Math.cos(pose.lat * D)));
  return [north, east];
}
export function zoomBy(factor) { pose.range = THREE.MathUtils.clamp(pose.range * factor, minRange(), MAX_RANGE); }

el.addEventListener('pointerdown', ev => {
  if (!input.enabled) return;
  el.setPointerCapture(ev.pointerId); pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
  interact(); vel.lat = vel.lon = 0;
  if (pointers.size === 2) { const [p, q] = [...pointers.values()]; pinch = { d: Math.hypot(p[0] - q[0], p[1] - q[1]), a: Math.atan2(q[1] - p[1], q[0] - p[0]), y: (p[1] + q[1]) / 2 }; drag = null; return; }
  drag = { x: ev.clientX, y: ev.clientY, rot: ev.button === 2 || ev.shiftKey || ev.ctrlKey || ev.metaKey, t: performance.now() };
});
el.addEventListener('pointermove', ev => {
  if (!pointers.has(ev.pointerId)) return;
  pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
  if (pinch && pointers.size === 2) {
    const [p, q] = [...pointers.values()]; const d = Math.hypot(p[0] - q[0], p[1] - q[1]), a = Math.atan2(q[1] - p[1], q[0] - p[0]), y = (p[1] + q[1]) / 2;
    zoomBy(pinch.d / Math.max(1, d)); pose.heading = norm180(pose.heading - (a - pinch.a) / D);
    pose.tilt = THREE.MathUtils.clamp(pose.tilt + (pinch.y - y) * 0.25, 0, maxTilt(pose.range));
    pinch = { d, a, y }; return;
  }
  if (!drag) return;
  const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; drag.x = ev.clientX; drag.y = ev.clientY;
  if (drag.rot || pose.alt > 1000) { pose.heading = norm180(pose.heading - dx * 0.3); pose.tilt = THREE.MathUtils.clamp(pose.tilt - dy * 0.25, 0, maxTilt(pose.range)); }
  else { const now = performance.now(), dt = Math.max(1, now - drag.t); drag.t = now; const [n, e] = panBy(dx, dy); vel.lat = n / dt * 16; vel.lon = e / dt * 16; }
});
const up = ev => { pointers.delete(ev.pointerId); if (pointers.size < 2) pinch = null; if (!pointers.size) drag = null; };
el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
el.addEventListener('contextmenu', ev => ev.preventDefault());
el.addEventListener('wheel', ev => {
  if (!input.enabled) return; ev.preventDefault(); interact();
  const dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
  goal.lr = THREE.MathUtils.clamp((goal.lr ?? Math.log(pose.range)) + THREE.MathUtils.clamp(dy, -200, 200) * 0.0016, Math.log(minRange()), Math.log(MAX_RANGE)); // eased in updateCamera
}, { passive: false });

// Keyboard: arrows pan, +/- zoom, [ ] rotate (when the canvas area has focus, i.e. no input field).
export function keyNav(ev) {
  const step = 40, pan = (dx, dy) => { const [n, e] = panDelta(dx, dy); goal.lat = (goal.lat ?? pose.lat) + n; goal.lon = (goal.lon ?? pose.lon) + e; };
  const zoom = f => { goal.lr = THREE.MathUtils.clamp((goal.lr ?? Math.log(pose.range)) + Math.log(f), Math.log(minRange()), Math.log(MAX_RANGE)); };
  const turn = d => { goal.heading = (goal.heading ?? pose.heading) + d; };
  switch (ev.key) { // each key sets a goal; updateCamera glides there
    case 'ArrowLeft': interact(); pan(step, 0); return true;
    case 'ArrowRight': interact(); pan(-step, 0); return true;
    case 'ArrowUp': interact(); pan(0, step); return true;
    case 'ArrowDown': interact(); pan(0, -step); return true;
    case '+': case '=': interact(); zoom(0.8); return true;
    case '-': case '_': interact(); zoom(1.25); return true;
    case '[': interact(); turn(10); return true;
    case ']': interact(); turn(-10); return true;
  }
  return false;
}

// Idle spin for the first screen (degrees of longitude per second).
// With stopAt set, the spin eases to a stop at that longitude (Pakistan comes into view).
export const spin = { on: false, rate: 3, stopAt: null };

export function setPose(p) { stopFly(); goal.lr = goal.lat = goal.lon = goal.heading = null; pose.alt = 0; Object.assign(pose, p); apply(); }
export function updateCamera(dt) {
  const now = performance.now();
  if (fly) stepFly(now);
  else {
    const k = 1 - Math.exp(-dt * 12);
    if (goal.lr != null) { const lr = Math.log(pose.range); pose.range = Math.exp(lr + (goal.lr - lr) * k); if (Math.abs(goal.lr - lr) < 1e-4) goal.lr = null; }
    if (goal.lat != null) { pose.lat = THREE.MathUtils.clamp(pose.lat + (goal.lat - pose.lat) * k, -85, 85); pose.lon = norm180(pose.lon + norm180(goal.lon - pose.lon) * k); if (Math.abs(goal.lat - pose.lat) + Math.abs(norm180(goal.lon - pose.lon)) < 1e-6) goal.lat = goal.lon = null; }
    if (goal.heading != null) { pose.heading = norm180(pose.heading + norm180(goal.heading - pose.heading) * k); if (Math.abs(norm180(goal.heading - pose.heading)) < 0.01) goal.heading = null; }
    if (spin.on && !drag) { const left = spin.stopAt == null ? 1 : THREE.MathUtils.smoothstep(spin.stopAt - pose.lon, 0, 30); pose.lon = norm180(pose.lon + spin.rate * Math.max(left, spin.stopAt == null ? 1 : 0) * dt); }
    if (!drag && (Math.abs(vel.lat) + Math.abs(vel.lon) > 1e-7)) { pose.lat = THREE.MathUtils.clamp(pose.lat + vel.lat, -85, 85); pose.lon = norm180(pose.lon + vel.lon); vel.lat *= 0.9; vel.lon *= 0.9; }
  }
  measure(now);
  apply();
}
apply();

// Scenario animations (Phase 5). Short-lived effects on the globe, each disposed
// when it ends or when the scenario stops. They decorate what the simulation
// does (a cut, a reroute, an alarm); they never decide anything themselves.
import * as THREE from 'three';
import { scene, layers, camera, fatLine, fatSegs, disposeLine } from './scene.js';
import { fromLatLon, faceUp } from './geo3.js';
import { burst } from './fx.js';
import { fadeIn, fadeOut } from './fade3d.js';
import { addCallout, removeCallout, addLabel, removeLabel } from './labels.js';
import { altitudeKm } from './globecam.js';

const live = new Set(); // { update(dt) → false when done, dispose() }
const add = a => { live.add(a); return a; };
// every object an effect puts on the globe fades in, and fades out when the scenario stops
const own = o => { o.userData.sfx = true; layers.fx.add(fadeIn(o)); return o; };
export function updateSceneFx(dt) { for (const a of live) if (a.update(dt) === false) { a.dispose(); live.delete(a); } }
export function clearSceneFx() {
  const items = [...live]; live.clear(); // they stop animating while they fade
  for (const o of layers.fx.children) if (o.userData.sfx) fadeOut(o, 300);
  setTimeout(() => items.forEach(a => a.dispose()), 320);
}

// A cable snaps: a quick cluster of bright sparks at the cut point.
export function spark(pos, n = 7) {
  let t = 0, k = 0;
  return add({ update(dt) { t += dt; while (k < n && t > k * 0.09) { burst(pos, k % 2 ? '#ffd27a' : '#ffffff', 0.05 + k * 0.025, 0.55); k++; } return t < 1; }, dispose() {} });
}

// A line that draws itself along pts (Vector3s) over `dur` seconds, then stays until cleared.
export function drawLine(pts, { color = 0xf0a35b, width = 2.2, dur = 4, dashed = true } = {}) {
  const l = fatLine(pts, { color, linewidth: width, opacity: 0.95, dashed, dashSize: 14, gapSize: 9 }); l.renderOrder = 8;
  const segs = pts.length - 1; let t = 0; l.geometry.instanceCount = 0; own(l);
  return add({ line: l, update(dt) { t += dt; l.geometry.instanceCount = Math.min(segs, Math.ceil(segs * t / dur)); return true; }, dispose() { layers.fx.remove(l); disposeLine(l); } });
}

// Expanding ripple rings from a place (news or a road sign spreading).
export function waves(pos, { color = '#f0a35b', every = 0.7, count = 4, size = 8, life = 2.4 } = {}) {
  let t = 0, k = 0;
  return add({ update(dt) { t += dt; while (k < count && t > k * every) { burst(pos, color, size, life); k++; } return t < count * every + life; }, dispose() {} });
}

// Rocks sliding down a slope near (lat, lon) along a compass bearing, over `dur` seconds.
export function rocks(lat, lon, bearingDeg = 200, { n = 60, distKm = 14, dur = 3.5 } = {}) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), start = [], end = [];
  const D = Math.PI / 180, kmLat = 1 / 111.2, kmLon = 1 / (111.2 * Math.cos(lat * D));
  for (let i = 0; i < n; i++) {
    const ox = (Math.random() - 0.5) * 6, oy = (Math.random() - 0.5) * 6, d = distKm * (0.6 + Math.random() * 0.5);
    start.push([lat + oy * kmLat, lon + ox * kmLon]);
    end.push([lat + (oy + Math.cos(bearingDeg * D) * d) * kmLat, lon + (ox + Math.sin(bearingDeg * D) * d) * kmLon]);
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({ color: 0x8a6a4a, size: 5, sizeAttenuation: false, transparent: true, opacity: 0.95, depthWrite: false });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 9; own(pts);
  let t = 0; const v = new THREE.Vector3();
  return add({
    update(dt) {
      t += dt; const f = Math.min(1, t / dur);
      for (let i = 0; i < n; i++) { const e = Math.min(1, f * (0.8 + (i % 5) * 0.08)); const ease = e * e; fromLatLon(start[i][0] + (end[i][0] - start[i][0]) * ease, start[i][1] + (end[i][1] - start[i][1]) * ease, 0.4, v); p.set([v.x, v.y, v.z], i * 3); }
      g.attributes.position.needsUpdate = true; m.size = 4 + 3 * Math.min(1, 300 / Math.max(50, altitudeKm)); return true;
    },
    dispose() { layers.fx.remove(pts); g.dispose(); m.dispose(); }
  });
}

// Roads to one place fade away (Facebook's road signs disappear). from: Vector3s, to: Vector3. One line object.
export function fadingRoads(from, to, { color = 0x8fc3e6, start = 0, dur = 6 } = {}) {
  const segs = [];
  for (const a of from) { const mid = a.clone().add(to).multiplyScalar(0.5); mid.setLength(Math.max(a.length(), to.length()) + a.distanceTo(to) * 0.18); const c = new THREE.QuadraticBezierCurve3(a, mid, to).getPoints(40); for (let i = 1; i < c.length; i++) segs.push({ a: c[i - 1], b: c[i] }); }
  const l = fatSegs(segs, { color, linewidth: 1.4, opacity: 0.8 }); l.renderOrder = 7; own(l);
  let t = 0;
  return add({ update(dt) { t += dt; const f = Math.max(0, Math.min(1, (t - start) / dur)); l.material.opacity = 0.8 * (1 - f); l.visible = f < 1; return true; }, dispose() { layers.fx.remove(l); disposeLine(l); } });
}

// Confused parcels: little dots circling around places, then giving up (fading).
export function circling(centres, { color = 0xc9d2d6, radiusKm = 60, dur = 10, perCentre = 6 } = {}) {
  const n = centres.length * perCentre, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({ color, size: 5, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 9; own(pts);
  const ll = centres.map(c => { const r = c.length(); return [Math.asin(c.z / r) * 180 / Math.PI, Math.atan2(c.y, c.x) * 180 / Math.PI]; });
  let t = 0; const v = new THREE.Vector3();
  return add({
    update(dt) {
      t += dt; const fade = Math.max(0, 1 - Math.max(0, t - dur * 0.6) / (dur * 0.4)); m.opacity = 0.9 * fade;
      let j = 0;
      for (const [la, lo] of ll) for (let k = 0; k < perCentre; k++) {
        const a = t * (1.2 + k * 0.15) + k * Math.PI * 2 / perCentre, r = radiusKm * (0.6 + 0.4 * Math.sin(t * 0.7 + k)) * (1 + (1 - fade) * 0.8);
        fromLatLon(la + Math.sin(a) * r / 111.2, lo + Math.cos(a) * r / (111.2 * Math.cos(la * Math.PI / 180)), 1, v); p.set([v.x, v.y, v.z], j++ * 3);
      }
      g.attributes.position.needsUpdate = true; return t < dur;
    },
    dispose() { layers.fx.remove(pts); g.dispose(); m.dispose(); }
  });
}

// Thin "secret signal" lines from devices to a server; set .found = true to turn them green. One line object.
export function signalLines(from, to, { color = 0xe5484d } = {}) {
  const segs = []; for (const a of from) { const m = a.clone().lerp(to, 0.5).setLength(Math.max(a.length(), to.length()) + 40); segs.push({ a, b: m }, { a: m, b: to }); }
  const l = fatSegs(segs, { color, linewidth: 1, opacity: 0.6, dashed: true, dashSize: 8, gapSize: 10 }); l.renderOrder = 7; own(l);
  let t = 0; const a = { found: false };
  return add(Object.assign(a, {
    update(dt) { t += dt; l.material.dashOffset -= dt * 30; l.material.opacity = 0.4 + 0.3 * (0.5 + 0.5 * Math.sin(t * 6)); if (a.found) l.material.color.set(0x3fb27f); return true; },
    dispose() { layers.fx.remove(l); disposeLine(l); }
  }));
}

// An illustrative server abroad: a small rack that keeps ~18 px on screen, with a label. Fades in.
export function serverMark(pos, text) {
  const g = new THREE.BoxGeometry(0.55, 0.55, 1).translate(0, 0, 0.5);
  const m = new THREE.MeshStandardMaterial({ color: 0x2b3238, roughness: 0.45, metalness: 0.5, emissive: 0xe5484d, emissiveIntensity: 0.35, transparent: true, opacity: 0 });
  const mesh = faceUp(new THREE.Mesh(g, m), pos); mesh.renderOrder = 6; own(mesh);
  const lab = addLabel(text, pos, { cls: 'intl', minR: 0, maxR: 1e9, prio: 0 });
  let t = 0;
  return add({
    update(dt) { t += dt; m.opacity = Math.min(1, t / 0.5); mesh.scale.setScalar(camera.position.distanceTo(pos) * 2 * Math.tan(camera.fov * Math.PI / 360) / innerHeight * 18); return true; },
    dispose() { layers.fx.remove(mesh); g.dispose(); m.dispose(); removeLabel(lab); }
  });
}

// Devices lighting up one by one (phones on the map). Returns their positions.
export function lightUp(points, { color = '#f0c27a', every = 0.35 } = {}) {
  let t = 0, k = 0;
  return add({ update(dt) { t += dt; while (k < points.length && t > k * every) { burst(points[k], color, 0.04, 1.2); k++; } if (k >= points.length && t > k * every + 1) { t = k * every - 0.6; points.forEach(p => burst(p, color, 0.03, 0.9)); } return true; }, dispose() {} });
}

// A DOM bubble pinned to a place (numbers, a bell, a stamp, a stopwatch). Returns { set(html), remove() }.
export function bubble(pos, html, cls = 'bub') {
  const o = addCallout(pos, html, cls);
  const a = { o, set: h => { o.element.innerHTML = h; }, flash: () => { o.element.classList.remove('flash'); void o.element.offsetWidth; o.element.classList.add('flash'); }, update() { return true; }, dispose() { removeCallout(o); } };
  return add(a);
}
export const remove = a => { if (a && live.has(a)) { a.dispose(); live.delete(a); } };

// A soft red dimming over a cable section near a point (the "cut" glow), fading after `life` s.
export function glow(pos, { color = 0xe5484d, sizeKm = 120, life = 6 } = {}) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.35, depthWrite: false }));
  faceUp(m, pos); m.renderOrder = 6; own(m); let t = 0;
  return add({ update(dt) { t += dt; m.scale.setScalar(Math.max(sizeKm, altitudeKm * 0.04) * (1 + 0.1 * Math.sin(t * 4))); m.material.opacity = 0.35 * Math.max(0, 1 - t / life); return t < life; }, dispose() { layers.fx.remove(m); m.geometry.dispose(); m.material.dispose(); } });
}
void scene;

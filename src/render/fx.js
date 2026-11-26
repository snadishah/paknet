// Effects on the globe: bursts, route highlight, cut marks, shields.
// Callers may pass flat map positions (the simulator's) or globe positions; G3 handles both.
// Sizes are given in flat units (1 ≈ 111 km) as before and converted to km here.
import * as THREE from 'three';
import { KM_PER_UNIT } from '../geo/globe.js';
import { buildPath } from '../routing/paths.js';
import { layers, fatLine, disposeLine } from './scene.js';
import { G3, faceUp, mapPolyline, edgeGlobe } from './geo3.js';
import { altitudeKm } from './globecam.js';

const gFX = () => layers.fx;
const K = KM_PER_UNIT;

const bursts = []; const burstGeo = new THREE.RingGeometry(0.75, 1, 48);
export function burst(pos, color = '#dc2626', s = 0.2, life = 0.8) {
  const m = new THREE.Mesh(burstGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  faceUp(m, G3(pos)); m.renderOrder = 8; gFX().add(m); bursts.push({ m, t: 0, life, s: s * K });
  if (bursts.length > 100) { const b = bursts.shift(); gFX().remove(b.m); b.m.material.dispose(); }
}

let hiLines = [];
export const hasHighlight = () => hiLines.length > 0;
export function clearHighlight() { hiLines.forEach(l => { gFX().remove(l); disposeLine(l); }); hiLines = []; }
export function highlightPath(src, pe) {
  clearHighlight(); const p = buildPath(src, pe); const flat = []; for (let i = 0; i < p.n; i++) flat.push({ x: p.arr[i * 3], y: p.arr[i * 3 + 1] });
  const pts = mapPolyline(flat);
  const a = fatLine(pts, { color: 0xffffff, linewidth: 6, opacity: 0.35 }); const b = fatLine(pts, { color: 0xf0a35b, linewidth: 3, opacity: 1, dashed: true, dashSize: 14, gapSize: 6 });
  b.userData.anim = true; a.renderOrder = b.renderOrder = 7; gFX().add(a, b); hiLines.push(a, b); return p;
}

const cutMarks = new Map();
const mRed = new THREE.MeshBasicMaterial({ color: 0xe5484d }), mWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
export function markCut(e) {
  const gp = edgeGlobe(e), mid = gp[Math.floor(gp.length * (e.cable ? 0.3 : 0.5))]; const g = new THREE.Group();
  const l = fatLine(gp, { color: 0xe5484d, linewidth: 2.4, opacity: 1, dashed: true, dashSize: 8, gapSize: 6 }); l.renderOrder = 7; g.add(l);
  const x = new THREE.Group(); const b1 = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.2), mRed); b1.rotation.z = 0.78; const b2 = b1.clone(); b2.rotation.z = -0.78;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), mWhite); disc.position.z = -0.001; x.add(disc, b1, b2);
  faceUp(x, mid); x.renderOrder = 9; g.add(x); g.userData = { x, line: l };
  gFX().add(g); cutMarks.set(e.id, g); e.cutPos = mid;
  scaleMarks();
}
export function unmarkCut(e) { const g = cutMarks.get(e.id); if (g) { gFX().remove(g); disposeLine(g.userData.line); cutMarks.delete(e.id); } }

// Cut marks and shields keep a readable screen size as the camera zooms.
function scaleMarks() { const s = Math.max(0.05, altitudeKm * 0.012); for (const g of cutMarks.values()) g.userData.x.scale.setScalar(s); }
export function setMarkScale() { scaleMarks(); }

const shields = [];
export function shieldAt(node, r = 0.42) {
  const g = new THREE.Group(), R = r * K;
  const d = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3fb27f, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }));
  d.rotation.x = Math.PI / 2;
  const ring = fatLine(Array.from({ length: 65 }, (_, i) => new THREE.Vector3(Math.cos(i / 64 * 6.283) * R, Math.sin(i / 64 * 6.283) * R, 0.5)), { color: 0x3fb27f, linewidth: 2, opacity: 0.9 });
  g.add(d, ring); faceUp(g, node.gpos || G3(node.pos)); gFX().add(g); shields.push(g); return g;
}
export function clearShields() { shields.forEach(s => { gFX().remove(s); s.traverse(o => { if (o.isLine2) disposeLine(o); else if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }); shields.length = 0; }

export function updateFx(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i]; b.t += dt; const f = b.t / b.life;
    if (f >= 1) { gFX().remove(b.m); b.m.material.dispose(); bursts.splice(i, 1); continue; }
    // never smaller than a few pixels' worth, never huge from space
    const s = Math.max(b.s, altitudeKm * 0.01) * (0.3 + f); b.m.scale.setScalar(s); b.m.material.opacity = (1 - f) * 0.9;
  }
  hiLines.forEach(l => { if (l.userData.anim) l.material.dashOffset -= dt * 20; });
  if (cutMarks.size) scaleMarks();
}

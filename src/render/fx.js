// Effects: bursts, route highlight, cut marks, shields.
import * as THREE from 'three';
import { TOP, lift } from '../geo/projection.js';
import { buildPath } from '../routing/paths.js';
import { layers, fatLine } from './scene.js';

const gFX = () => layers.fx;
const mRed = new THREE.MeshLambertMaterial({ color: 0xdc2626 }), mWhite = new THREE.MeshLambertMaterial({ color: 0xffffff });

const bursts = []; const burstGeo = new THREE.RingGeometry(0.75, 1, 40);
export function burst(pos, color = '#dc2626', s = 0.2, life = 0.8) {
  const m = new THREE.Mesh(burstGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.position.copy(pos); gFX().add(m); bursts.push({ m, t: 0, life, s });
  if (bursts.length > 100) { const b = bursts.shift(); gFX().remove(b.m); b.m.material.dispose(); }
}

let hiLines = [];
export const hasHighlight = () => hiLines.length > 0;
export function clearHighlight() { hiLines.forEach(l => { gFX().remove(l); l.geometry.dispose(); l.material.dispose(); }); hiLines = []; }
export function highlightPath(src, pe) {
  clearHighlight(); const p = buildPath(src, pe); const pts = []; for (let i = 0; i < p.n; i++) pts.push(new THREE.Vector3(p.arr[i * 3], p.arr[i * 3 + 1], p.arr[i * 3 + 2] - 0.005));
  const a = fatLine(pts, { color: 0xffffff, linewidth: 8, opacity: 0.9 }); const b = fatLine(pts, { color: 0xd97706, linewidth: 4, opacity: 1, dashed: true, dashSize: 0.12, gapSize: 0.05 });
  b.userData.anim = true; gFX().add(a, b); hiLines.push(a, b); return p;
}

const cutMarks = new Map();
export function markCut(e) {
  const mid = e.pts[Math.floor(e.pts.length * (e.cable ? 0.3 : 0.5))]; const g = new THREE.Group();
  g.add(fatLine(e.pts.map(p => lift(p, 0.004)), { color: 0xdc2626, linewidth: 2.6, opacity: 1, dashed: true, dashSize: 0.05, gapSize: 0.04 }));
  const x = new THREE.Group(); const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.03), mRed); b1.rotation.z = 0.78; const b2 = b1.clone(); b2.rotation.z = -0.78;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.16, 32), mWhite); disc.position.z = -0.01; x.add(disc, b1, b2); x.position.copy(mid).setZ(mid.z + 0.05); g.add(x);
  x.scale.setScalar(markScale); g.userData.x = x;
  gFX().add(g); cutMarks.set(e.id, g); e.cutPos = mid;
}
export function unmarkCut(e) { const g = cutMarks.get(e.id); if (g) { gFX().remove(g); cutMarks.delete(e.id); } }

// Cut marks scale with zoom like the router glyphs, so they stay a readable size.
let markScale = 1;
export function setMarkScale(f) { markScale = f; for (const g of cutMarks.values()) g.userData.x.scale.setScalar(f); }

const shields = [];
export function shieldAt(node, r = 0.42) {
  const g = new THREE.Group();
  const d = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x16a34a, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
  d.rotation.x = Math.PI / 2; const ring = fatLine(Array.from({ length: 65 }, (_, i) => new THREE.Vector3(Math.cos(i / 64 * 6.283) * r, Math.sin(i / 64 * 6.283) * r, 0.005)), { color: 0x16a34a, linewidth: 2, opacity: 0.9 });
  g.add(d, ring); g.position.copy(node.pos).setZ(TOP); gFX().add(g); shields.push(g); return g;
}
export function clearShields() { shields.forEach(s => gFX().remove(s)); shields.length = 0; }

export function updateFx(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i]; b.t += dt; const f = b.t / b.life;
    if (f >= 1) { gFX().remove(b.m); b.m.material.dispose(); bursts.splice(i, 1); continue; }
    b.m.scale.setScalar(b.s * (0.3 + f)); b.m.material.opacity = (1 - f) * 0.9;
  }
  hiLines.forEach(l => { if (l.userData.anim) l.material.dashOffset -= dt * 0.5; });
}

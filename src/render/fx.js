// Effects on the globe: bursts, route highlight, cut marks, shields.
// Callers may pass flat map positions (the simulator's) or globe positions; G3 handles both.
// Sizes are given in flat units (1 ≈ 111 km) as before and converted to km here.
// Draw calls stay constant: all bursts are one Points object, all cut lines one
// line object and all cut "X" marks one Points object, however many there are.
import * as THREE from 'three';
import { KM_PER_UNIT } from '../geo/globe.js';
import { buildPath } from '../routing/paths.js';
import { layers, fatLine, fatSegs, disposeLine, camera, renderer, onResize } from './scene.js';
import { G3, faceUp, mapPolyline, edgeGlobe, fromLatLon } from './geo3.js';
import { altitudeKm } from './globecam.js';
import { fadeIn, fadeOut } from './fade3d.js';

const gFX = () => layers.fx;
const K = KM_PER_UNIT;

// ---------- bursts: expanding rings, one Points object (≤ 300 at once) ----------
const MAXB = 300;
const bPos = new Float32Array(MAXB * 3), bCol = new Float32Array(MAXB * 3), bSize = new Float32Array(MAXB), bAlpha = new Float32Array(MAXB);
const bGeo = new THREE.BufferGeometry();
bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3)); bGeo.setAttribute('aColor', new THREE.BufferAttribute(bCol, 3));
bGeo.setAttribute('aSize', new THREE.BufferAttribute(bSize, 1)); bGeo.setAttribute('aAlpha', new THREE.BufferAttribute(bAlpha, 1));
const projScale = () => renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
const bMat = new THREE.ShaderMaterial({
  // no depth test: a big ring must not be cut in half by the globe; rings behind the Earth are skipped in updateFx
  transparent: true, depthWrite: false, depthTest: false, uniforms: { uProj: { value: projScale() }, uPR: { value: renderer.getPixelRatio() } },
  vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uProj; uniform float uPR; varying vec3 vC; varying float vA;
    void main(){ vC=aColor; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize = min(180. * uPR, aSize * uProj / -mv.z); /* a ring never fills the screen */ gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vC; varying float vA; void main(){ float r=length(gl_PointCoord-.5)*2.; float a = smoothstep(.84,.9,r) * (1.-smoothstep(.96,1.,r)); if (a<=0.) discard; gl_FragColor=vec4(vC, a*vA); }`
});
const bPoints = new THREE.Points(bGeo, bMat); bPoints.frustumCulled = false; bPoints.renderOrder = 8;
onResize(() => { bMat.uniforms.uProj.value = projScale(); });
const bursts = []; const tmpC = new THREE.Color();
export function burst(pos, color = '#dc2626', s = 0.2, life = 0.8) {
  if (!bPoints.parent) gFX().add(bPoints);
  if (bursts.length >= MAXB) bursts.shift();
  bursts.push({ p: G3(pos), c: tmpC.set(color).toArray(), t: 0, life, s: s * K });
}

// ---------- route highlight ----------
let hiLines = [];
export const hasHighlight = () => hiLines.length > 0;
export function clearHighlight() { hiLines.forEach(l => fadeOut(l, 300, () => { gFX().remove(l); disposeLine(l); })); hiLines = []; }
export function highlightPath(src, pe) {
  clearHighlight(); const p = buildPath(src, pe);
  // stitch each edge's drawn geometry (road-following where it has a road) in travel order
  const pts = []; let cur = src;
  for (const e of pe) { const g = edgeGlobe(e), fw = e.a === cur, seg = fw ? g : [...g].reverse(); for (let i = pts.length ? 1 : 0; i < seg.length; i++) pts.push(seg[i]); cur = fw ? e.b : e.a; }
  const a = fatLine(pts, { color: 0xffffff, linewidth: 6, opacity: 0.35 }); const b = fatLine(pts, { color: 0xf0a35b, linewidth: 3, opacity: 1, dashed: true, dashSize: 14, gapSize: 6 });
  b.userData.anim = true; a.renderOrder = b.renderOrder = 7; gFX().add(fadeIn(a), fadeIn(b)); hiLines.push(a, b); return p;
}

// ---------- cut marks: red dashed lines + an X, two draw calls for all of them ----------
const cutMarks = new Map(); // edge id → { e, mid }
let cutLines = null, cutX = null;
const xMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: { uPR: { value: renderer.getPixelRatio() } },
  vertexShader: 'uniform float uPR; void main(){ gl_PointSize = 18. * uPR; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `void main(){ vec2 p = gl_PointCoord*2.-1.; float r = length(p); if (r > 1.) discard;
    float d = min(abs(p.x-p.y), abs(p.x+p.y)) / 1.4142; float x = (1.-smoothstep(.12,.2,d)) * step(r,.62);
    gl_FragColor = x > .5 ? vec4(.9,.28,.3,1.) : vec4(1.,1.,1.,.95*(1.-smoothstep(.85,1.,r))); }`
});
function rebuildCuts() {
  if (cutLines) { gFX().remove(cutLines); disposeLine(cutLines); cutLines = null; }
  if (cutX) { gFX().remove(cutX); cutX.geometry.dispose(); cutX = null; }
  if (!cutMarks.size) return;
  const segs = []; for (const { e } of cutMarks.values()) { const gp = edgeGlobe(e); for (let i = 1; i < gp.length; i++) segs.push({ a: gp[i - 1], b: gp[i] }); }
  cutLines = fatSegs(segs, { color: 0xe5484d, linewidth: 2.4, opacity: 1, dashed: true, dashSize: 8, gapSize: 6 }); cutLines.renderOrder = 7; gFX().add(cutLines);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...cutMarks.values()].flatMap(c => [c.mid.x, c.mid.y, c.mid.z]), 3));
  cutX = new THREE.Points(g, xMat); cutX.frustumCulled = false; cutX.renderOrder = 9; gFX().add(cutX);
}
// the mark goes where the real fault was, if the scenario knows (e.cutAt)
export function markCut(e) { const gp = edgeGlobe(e), mid = e.cutAt ? fromLatLon(e.cutAt.lat, e.cutAt.lon) : gp[Math.floor(gp.length * (e.cable ? 0.3 : 0.5))]; e.cutPos = mid; cutMarks.set(e.id, { e, mid }); rebuildCuts(); }
export function unmarkCut(e) { if (cutMarks.delete(e.id)) rebuildCuts(); }
export function setMarkScale() {}
export function setFxPixelRatio(pr) { xMat.uniforms.uPR.value = pr; bMat.uniforms.uPR.value = pr; bMat.uniforms.uProj.value = projScale(); }
// Remove every ring at once (a scenario ends: its ripples must not spill into the next view)
export function clearBursts() { bursts.length = 0; }

// ---------- shields ----------
const shields = [];
export function shieldAt(node, r = 0.42) {
  const g = new THREE.Group(), R = r * K;
  const d = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ toneMapped: false, color: 0x3fb27f, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }));
  d.rotation.x = Math.PI / 2;
  const ring = fatLine(Array.from({ length: 65 }, (_, i) => new THREE.Vector3(Math.cos(i / 64 * 6.283) * R, Math.sin(i / 64 * 6.283) * R, 0.5)), { color: 0x3fb27f, linewidth: 2, opacity: 0.9 });
  g.add(d, ring); faceUp(g, node.gpos || G3(node.pos)); gFX().add(g); shields.push(g); return g;
}
export function clearShields() { shields.forEach(s => { gFX().remove(s); s.traverse(o => { if (o.isLine2) disposeLine(o); else if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }); shields.length = 0; }

const tc = new THREE.Vector3();
const behind = p => { tc.copy(camera.position).sub(p); return tc.dot(p) < 0 && p.lengthSq() < 6500 * 6500; };
export function updateFx(dt) {
  let j = 0;
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i]; b.t += dt; const f = b.t / b.life;
    if (f >= 1) { bursts.splice(i, 1); continue; }
    if (behind(b.p)) continue;
    // never smaller than a few pixels' worth, never huge from space
    const s = Math.max(b.s, altitudeKm * 0.01) * (0.3 + f) * 2;
    bPos[j * 3] = b.p.x; bPos[j * 3 + 1] = b.p.y; bPos[j * 3 + 2] = b.p.z; bCol.set(b.c, j * 3); bSize[j] = s; bAlpha[j] = (1 - f) * 0.9; j++;
  }
  bGeo.setDrawRange(0, j); bPoints.visible = j > 0;
  for (const a of ['position', 'aColor', 'aSize', 'aAlpha']) bGeo.attributes[a].needsUpdate = true;
  hiLines.forEach(l => { if (l.userData.anim) l.material.dashOffset -= dt * 20; });
}

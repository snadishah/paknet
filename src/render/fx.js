// Effects on the globe: bursts, route highlight, cut marks, shields.
// Callers may pass flat map positions (the simulator's) or globe positions; G3 handles both.
// Sizes are given in flat units (1 ≈ 111 km) as before and converted to km here.
// Draw calls stay constant: all bursts are one instanced mesh, all cut lines one line object and
// all cut "X" marks one Points object, however many there are (plus a small 3D marker per cut up close).
import * as THREE from 'three';
import { KM_PER_UNIT, greatCircle } from '../geo/globe.js';
import { buildPath } from '../routing/paths.js';
import { layers, fatLine, fatSegs, disposeLine, camera, renderer } from './scene.js';
import { G3, faceUp, mapPolyline, edgeGlobe, fromLatLon } from './geo3.js';
import { altitudeKm } from './globecam.js';
import { fadeIn, fadeOut } from './fade3d.js';
import { buoy, barrier } from './models/markers.js';

const gFX = () => layers.fx;
const K = KM_PER_UNIT;

// ---------- bursts: expanding rings lying on the ground, sized in km, one instanced mesh (≤ 300 at once) ----------
// Depth-tested, so the Earth hides the ones behind it; never smaller than a few pixels nor bigger than ~90 px across.
const MAXB = 300;
const bAlphaA = new THREE.InstancedBufferAttribute(new Float32Array(MAXB), 1), bColA = new THREE.InstancedBufferAttribute(new Float32Array(MAXB * 3), 3);
const ringGeo = new THREE.RingGeometry(0.84, 1, 48); ringGeo.setAttribute('aAlpha', bAlphaA); ringGeo.setAttribute('aColor', bColA);
const bMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: `attribute vec3 aColor; attribute float aAlpha; varying vec3 vC; varying float vA; varying float vR;
    void main(){ vC=aColor; vA=aAlpha; vR=length(position.xy); gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.); }`,
  fragmentShader: `varying vec3 vC; varying float vA; varying float vR; void main(){ float a = smoothstep(.84,.9,vR) * (1.-smoothstep(.96,1.,vR)); gl_FragColor=vec4(vC, a*vA); }`
});
const bRings = new THREE.InstancedMesh(ringGeo, bMat, MAXB); bRings.count = 0; bRings.frustumCulled = false; bRings.renderOrder = 8;
const bursts = []; const tmpC = new THREE.Color();
export function burst(pos, color = '#dc2626', s = 0.2, life = 0.8) {
  if (!bRings.parent) gFX().add(bRings);
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
const xMat = new THREE.ShaderMaterial({ // uA: fades out as the 3D marker takes over
  transparent: true, depthWrite: false, uniforms: { uPR: { value: renderer.getPixelRatio() }, uA: { value: 1 } },
  vertexShader: 'uniform float uPR; void main(){ gl_PointSize = 18. * uPR; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }', // uA: fades out as the 3D marker takes over
  fragmentShader: `uniform float uA; void main(){ vec2 p = gl_PointCoord*2.-1.; float r = length(p); if (r > 1.) discard;
    float d = min(abs(p.x-p.y), abs(p.x+p.y)) / 1.4142; float x = (1.-smoothstep(.12,.2,d)) * step(r,.62);
    gl_FragColor = x > .5 ? vec4(.9,.28,.3,uA) : vec4(1.,1.,1.,.95*uA*(1.-smoothstep(.85,1.,r))); }`
});
function rebuildCuts() {
  if (cutLines) { gFX().remove(cutLines); disposeLine(cutLines); cutLines = null; }
  if (cutX) { gFX().remove(cutX); cutX.geometry.dispose(); cutX = null; }
  if (!cutMarks.size) return;
  // the whole broken cable in red: its hop, its onward route abroad and, if the fault is on a branch the
  // route data lacks (AAE-1 into the Gulf), that branch (e.cutVia, [lat, lon] waypoints) up to the fault
  const segs = [], line = gp => { for (let i = 1; i < gp.length; i++) segs.push({ a: gp[i - 1], b: gp[i] }); };
  for (const { e } of cutMarks.values()) {
    line(edgeGlobe(e)); if (e.onward) line(e.onward.gpts); if (e.onwardGulf) line(e.onwardGulf.gpts);
    if (e.cutVia && e.cutAt) line([...e.cutVia, [e.cutAt.lat, e.cutAt.lon]].flatMap(([la, lo], i, a) => i ? greatCircle(a[i - 1][0], a[i - 1][1], la, lo, 12).slice(1) : [[la, lo]]).map(([la, lo]) => fromLatLon(la, lo)));
  }
  cutLines = fatSegs(segs, { color: 0xe5484d, linewidth: 2.4, opacity: 1, dashed: true, dashSize: 8, gapSize: 6 }); cutLines.renderOrder = 7; gFX().add(cutLines);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...cutMarks.values()].flatMap(c => [c.mid.x, c.mid.y, c.mid.z]), 3));
  cutX = new THREE.Points(g, xMat); cutX.frustumCulled = false; cutX.renderOrder = 9; gFX().add(cutX);
}
// the mark goes where the real fault was, if the scenario knows (e.cutAt). From afar it is an X; below
// ~600 km a 3D marker takes over: a buoy over a cut submarine cable, a barrier on a cut road.
export function markCut(e) {
  const gp = edgeGlobe(e), mid = e.cutAt ? fromLatLon(e.cutAt.lat, e.cutAt.lon) : gp[Math.floor(gp.length * (e.cable ? 0.3 : 0.5))]; e.cutPos = mid;
  const m = (e.cable ? buoy : barrier)(); m.matrixAutoUpdate = false; m.traverse(o => { if (o.material) o.material.transparent = true; }); gFX().add(m);
  cutMarks.get(e.id)?.model && dropModel(cutMarks.get(e.id).model);
  cutMarks.set(e.id, { e, mid, model: m, water: !!e.cable }); rebuildCuts();
}
export function unmarkCut(e) { const c = cutMarks.get(e.id); if (c) { dropModel(c.model); cutMarks.delete(e.id); rebuildCuts(); } }
const dropModel = m => fadeOut(m, 300, () => { gFX().remove(m); m.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); });
export function setMarkScale() {}
export function setFxPixelRatio(pr) { xMat.uniforms.uPR.value = pr; }
// Remove every ring at once (a scenario ends: its ripples must not spill into the next view)
export function clearBursts() { bursts.length = 0; }

// ---------- shields ----------
const shields = [], shieldTime = { value: 0 };
export function shieldAt(node, r = 0.42) {
  const g = new THREE.Group(), R = r * K;
  // an energy dome: clear in the middle, bright at its rim (fresnel), a faint band sweeping up it
  const d = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uT: shieldTime },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vH; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = -mv.xyz; vH = position.y / ${R.toFixed(4)}; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uT; varying vec3 vN; varying vec3 vV; varying float vH;
      void main(){ float f = pow(1. - abs(dot(normalize(vN), normalize(vV))), 2.2); float band = smoothstep(.06, 0., abs(fract(uT * .35) - vH)) * .35;
        gl_FragColor = vec4(vec3(.25,.85,.55) * (.05 + .75 * f + band), 1.); }`
  }));
  d.rotation.x = Math.PI / 2;
  const ring = fatLine(Array.from({ length: 65 }, (_, i) => new THREE.Vector3(Math.cos(i / 64 * 6.283) * R, Math.sin(i / 64 * 6.283) * R, 0.5)), { color: 0x3fb27f, linewidth: 2, opacity: 0.9 });
  g.add(d, ring); faceUp(g, node.gpos || G3(node.pos)); gFX().add(g); shields.push(g); return g;
}
export function clearShields() { shields.forEach(s => { gFX().remove(s); s.traverse(o => { if (o.isLine2) disposeLine(o); else if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }); shields.length = 0; }

const o3 = new THREE.Object3D(), up = new THREE.Vector3(0, 0, 1), n3 = new THREE.Vector3();
const pxKm = d => 2 * d * Math.tan(camera.fov * Math.PI / 360) / innerHeight; // km per pixel at distance d
export function updateFx(dt) {
  let j = 0;
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i]; b.t += dt; const f = b.t / b.life;
    if (f >= 1) { bursts.splice(i, 1); continue; }
    const px = pxKm(camera.position.distanceTo(b.p));
    // the old sizes were diameters; never smaller than a few pixels' worth, never more than ~90 px across
    const r = Math.min(Math.max(b.s, altitudeKm * 0.01) * (0.3 + f), 90 * px);
    n3.copy(b.p).normalize(); o3.position.copy(b.p).addScaledVector(n3, 2 * px); o3.quaternion.setFromUnitVectors(up, n3); o3.scale.setScalar(r); o3.updateMatrix();
    bRings.setMatrixAt(j, o3.matrix); bColA.setXYZ(j, b.c[0], b.c[1], b.c[2]); bAlphaA.setX(j, (1 - f) * 0.9); j++;
  }
  bRings.count = j; bRings.visible = j > 0;
  if (j) { bRings.instanceMatrix.needsUpdate = true; bColA.needsUpdate = bAlphaA.needsUpdate = true; }
  hiLines.forEach(l => { if (l.userData.anim) l.material.dashOffset -= dt * 20; });
  shieldTime.value += dt;
  // cut markers: the X from afar, the 3D marker (at least ~44 px tall) closer in; the buoy bobs on the swell
  const near = 1 - THREE.MathUtils.smoothstep(altitudeKm, 350, 700); xMat.uniforms.uA.value = 1 - near;
  for (const c of cutMarks.values()) {
    const m = c.model; if (!m) continue; m.visible = near > 0.01; if (!m.visible) continue;
    m.traverse(o => { if (o.material) o.material.opacity = near; });
    const k = Math.max(1, 44 * pxKm(camera.position.distanceTo(c.mid)) / 0.0045), t = performance.now() / 1000;
    n3.copy(c.mid).normalize(); o3.position.copy(c.mid).addScaledVector(n3, c.water ? 0.0002 * Math.sin(t * 1.3) * k : 0);
    o3.quaternion.setFromUnitVectors(up, n3); if (c.water) o3.rotateX(0.06 * Math.sin(t * 0.9)).rotateY(0.05 * Math.sin(t * 1.1));
    o3.scale.setScalar(0.001 * k); o3.updateMatrix(); m.matrix.copy(o3.matrix); m.matrixWorldNeedsUpdate = true;
  }
}

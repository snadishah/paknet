// Satellites in 3D: every satellite is one point of a single THREE.Points (one
// draw call), the geostationary belt is one ring and a few sample orbits are one
// line object, so satellites add at most 3 draw calls. Positions come from a Web
// Worker (SGP4, ≤ 5 Hz) and are interpolated every frame. PakSat-MM1 also gets
// an "approximate coverage" disc, and the network's PakSat links follow it.
import * as THREE from 'three';
import { GROUPS, SAT_INFO, GROUP_INFO, decodeSnapshot } from '../sat/catalog.js';
import { makeRecords, positionsAt, orbitRing } from '../sat/propagate.js';
import { R, GEO_ALT, ecefToLatLon } from '../geo/globe.js';
import { scene, camera, renderer, fatSegs, disposeLine } from './scene.js';
import { paksatPos } from './network.js';
import { addLabel } from './labels.js';
import { fromLatLon } from './geo3.js';
import { busyBegin } from '../busy.js';
import { paksatShown, paksat1RShown, paksatClose } from './paksat3d.js';

export const satLayers = { far: true, soon: false, eyes: false, nav: false };
export const satMeta = { fetched: null, groups: {} };
let SNAP = { fetched: null };
const ROLE_STYLE = { pk: ['#f2d8a7', 11], retired: ['#8a949a', 8], soon: ['#cfd6db', 3.2], eyes: ['#9fe0c4', 6], nav: ['#a9c4f0', 4.5] };

// The orbit snapshot (src/data/satellites.json, copied to assets/) is loaded after
// the first screen is up, so it doesn't slow the start. Until then there are no satellites.
let list = [], N = 0, iMM1 = -1, i1R = -1; // list: { key, g, omm, norad, name, role }
let pos = new Float32Array(0), vis = new Float32Array(0), visT = new Float32Array(0), lastVis = 0; // vis eases towards visT (fades, 400 ms)
const geo = new THREE.BufferGeometry();
function setup(snap) {
  SNAP = snap; satMeta.fetched = snap.fetched;
  const groups = decodeSnapshot(snap); list = [];
  for (const [key, g] of Object.entries(GROUPS)) {
    const d = groups[key]; if (!d) continue;
    satMeta.groups[key] = { total: d.total, shown: d.sats.length, sampled: d.sampled };
    for (const omm of d.sats) list.push({ key, g, omm, norad: omm.NORAD_CAT_ID, name: omm.OBJECT_NAME });
  }
  N = list.length; iMM1 = list.findIndex(s => s.norad === 59915); i1R = list.findIndex(s => s.norad === 37779);
  pos = new Float32Array(N * 3); vis = new Float32Array(N); visT = new Float32Array(N);
  const col = new Float32Array(N * 3), size = new Float32Array(N), kind = new Float32Array(N), c = new THREE.Color();
  list.forEach((s, i) => {
    const role = s.norad === 37779 ? 'retired' : s.g.role; const [hex, sz] = ROLE_STYLE[role];
    c.set(hex); col.set([c.r, c.g, c.b], i * 3); size[i] = sz;
    kind[i] = role === 'soon' ? 1 : role === 'retired' ? 2 : 0; // 1: hollow ring ("not yet"), 2: grey dot
    s.role = role;
  });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1)); geo.setAttribute('aVis', new THREE.BufferAttribute(vis, 1));
}
export const satUniforms = { uPR: { value: renderer.getPixelRatio() }, uScale: { value: 1 } };
const mat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: satUniforms,
  vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aKind; attribute float aVis; uniform float uPR; uniform float uScale;
    varying vec3 vC; varying float vK; varying float vV;
    void main(){ vC=aColor; vK=aKind; vV=aVis; vec4 mv = modelViewMatrix*vec4(position,1.);
      gl_PointSize = aVis < .01 ? 0. : aSize * uScale * uPR; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vC; varying float vK; varying float vV;
    void main(){ if (vV < .01) discard; float r = length(gl_PointCoord-.5)*2.; if (r>1.) discard;
      float a = 1.-smoothstep(.65,1.,r);
      if (vK > .5 && vK < 1.5) a *= smoothstep(.35,.6,r) * .75; // hollow: "coming soon"
      if (vK > 1.5) a *= .6;
      gl_FragColor = vec4(mix(vec3(1.), vC, smoothstep(0.,.5,r)), a * vV); }`
});
const points = new THREE.Points(geo, mat); points.frustumCulled = false; points.renderOrder = 4;

// ---------- GEO belt and sample orbit tracks ----------
const BELT = Array.from({ length: 241 }, (_, i) => { const a = i / 240 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * (R + GEO_ALT), Math.sin(a) * (R + GEO_ALT), 0); });
let tracks = null; let trackIdx = [];
function pickTracks() {
  trackIdx = [];
  for (const [key, g] of Object.entries(GROUPS)) {
    if (!g.tracks || !satLayers[g.layer]) continue;
    const idx = list.map((s, i) => [s, i]).filter(([s]) => s.key === key).map(([, i]) => i);
    for (let k = 0; k < Math.min(g.tracks, idx.length); k++) trackIdx.push(idx[Math.floor(k * idx.length / g.tracks)]);
  }
}
function setTracks(rings) {
  if (tracks) { group.remove(tracks); disposeLine(tracks); tracks = null; }
  const segs = []; const cc = new THREE.Color();
  if (satLayers.far) for (let i = 1; i < BELT.length; i++) segs.push({ a: BELT[i - 1], b: BELT[i], c: '#f2d8a7' }); // the geostationary belt
  rings.forEach((ring, j) => { const s = list[trackIdx[j]]; cc.set(ROLE_STYLE[s.role][0]); const hex = '#' + cc.getHexString(); for (let i = 1; i < ring.length; i++) segs.push({ a: new THREE.Vector3(...ring[i - 1]), b: new THREE.Vector3(...ring[i]), c: hex }); });
  if (!segs.length) return;
  tracks = fatSegs(segs, { vertexColors: true, linewidth: 0.8, opacity: 0.35, dashed: false }); tracks.renderOrder = 3; group.add(tracks);
}

// ---------- PakSat-MM1 coverage disc ("approximate coverage") ----------
// Where the satellite is at least 10° above the horizon: a cap of ~71° around the sub-satellite point.
const capMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, depthTest: false, uniforms: { uOpacity: { value: 0.16 } }, // drawn like the tiles: no depth test, back faces culled
  vertexShader: 'varying float vF; attribute float aF; void main(){ vF=aF; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform float uOpacity; varying float vF; void main(){ float a = (1.-smoothstep(.75,1.,vF)) * uOpacity * (.55 + .45*smoothstep(.6,.95,vF)); gl_FragColor = vec4(.75,.66,.95,a); }'
});
function capGeometry(lat0, lon0, angDeg, nR = 24, nA = 96) {
  const p = [], f = [], idx = [], ctr = fromLatLon(lat0, lon0).normalize();
  const tmp = Math.abs(ctr.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(ctr, tmp).normalize(), w = new THREE.Vector3().crossVectors(ctr, u);
  for (let i = 0; i <= nR; i++) for (let j = 0; j <= nA; j++) {
    const th = angDeg * Math.PI / 180 * i / nR, ph = j / nA * Math.PI * 2;
    const v = ctr.clone().multiplyScalar(Math.cos(th)).addScaledVector(u, Math.sin(th) * Math.cos(ph)).addScaledVector(w, Math.sin(th) * Math.sin(ph)).multiplyScalar(R + 2);
    p.push(v.x, v.y, v.z); f.push(i / nR);
  }
  for (let i = 0; i < nR; i++) for (let j = 0; j < nA; j++) { const a = i * (nA + 1) + j, b = a + nA + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  // make the triangles face outwards (front faces), so the far side is culled
  const P = k => new THREE.Vector3(p[k * 3], p[k * 3 + 1], p[k * 3 + 2]);
  const t0 = P(idx[3]), n0 = new THREE.Vector3().crossVectors(P(idx[4]).sub(t0), P(idx[5]).sub(t0));
  if (n0.dot(t0) < 0) for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('aF', new THREE.Float32BufferAttribute(f, 1)); g.setIndex(idx); return g;
}
const cap = new THREE.Mesh(capGeometry(0, 38.2, 71.4), capMat); cap.renderOrder = -1.8;
let capAt = null;

const group = new THREE.Group(); group.name = 'satellites';
group.add(points, cap); // the GEO belt is part of the tracks object (setTracks)

// ---------- propagation: worker at ≤ 5 Hz, main-thread fallback ----------
let A = null, B = null, tA = 0, tB = 1, pending = false, lastAsk = 0, worker = null;
const recsMain = { recs: null };
function ask(t, rate) {
  const ahead = Math.max(200, 200 * Math.abs(rate)); // positions 0.2 s of wall time ahead, in sim ms
  pending = true; lastAsk = performance.now();
  if (worker) worker.postMessage({ type: 'pos', t0: t, t1: t + ahead, id: 0 });
  else {
    recsMain.recs ||= makeRecords(list.map(s => s.omm));
    const a = positionsAt(recsMain.recs, new Date(t), new Float32Array(N * 3)), b = positionsAt(recsMain.recs, new Date(t + ahead), new Float32Array(N * 3));
    onPos(t, t + ahead, a, b);
  }
}
function onPos(t0, t1, a, b) { A = a; B = b; tA = t0; tB = t1; pending = false; }
function askRings(t) {
  pickTracks();
  if (!trackIdx.length) { setTracks([]); return; }
  if (worker) worker.postMessage({ type: 'rings', idx: trackIdx, t });
  else { recsMain.recs ||= makeRecords(list.map(s => s.omm)); setTracks(trackIdx.map(i => orbitRing(recsMain.recs[i], new Date(t)))); }
}

export function initSatellites(clock, onMove) {
  scene.add(group);
  satState.clock = clock; satState.onMove = onMove;
  const end = busyBegin('Loading satellites');
  fetch('assets/satellites.json').then(r => r.json()).then(snap => {
    setup(snap);
    try {
      worker = new Worker(new URL('satworker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data: m }) => { if (m.type === 'pos') onPos(m.t0, m.t1, m.a, m.b); else if (m.type === 'rings') setTracks(m.rings); };
      worker.onerror = () => { worker = null; pending = false; };
      worker.postMessage({ type: 'init', omms: list.map(s => s.omm) });
    } catch { worker = null; }
    applyLayers(); satState.ready = true;
  }).catch(() => { satState.failed = true; }).finally(end);
  // labels that follow their satellite
  satState.mm1Label = addLabel('PakSat-MM1', new THREE.Vector3(), { cls: 'sat', minR: 4000, maxR: 1e9, prio: 1, key: 'sat:mm1', layer: null });
  satState.r1Label = addLabel('PakSat-1R (retired)', new THREE.Vector3(), { cls: 'sat dim', minR: 30000, maxR: 1e9, prio: 6, key: 'sat:1r' });
  satState.mm1Label.extraVisible = () => satLayers.far; satState.r1Label.extraVisible = () => satLayers.far;
  // the coverage disc has no label of its own (it sat on the Earth): PakSat-MM1's card explains it
}
export const satState = { started: false, clock: null, onMove: null, ringT: -1e15, mm1Label: null, r1Label: null };

// Quality fallback: draw only every `step`-th "coming soon" satellite.
let sampleStep = 1;
export function setSatSample(step) { sampleStep = step; applyLayers(); }
export function applyLayers() {
  if (!N) { setTracks([]); return; }
  list.forEach((s, i) => { visT[i] = satLayers[s.g.layer] && (s.role !== 'soon' || i % sampleStep === 0) ? 1 : 0; }); // updateSatellites fades towards these
  satState.capOn = satLayers.far; // updateSatellites shows the disc only from high up (no one-frame flash here)
  satState.ringT = -1e15; // recompute tracks for the visible groups
}

const p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
export function updateSatellites() {
  if (!N) return; // snapshot not loaded yet
  const t = satState.clock.t, rate = satState.clock.rate;
  if (iMM1 >= 0) visT[iMM1] = paksatShown() ? 0 : satLayers.far ? 1 : 0; // the 3D models replace the dots
  if (i1R >= 0) visT[i1R] = paksat1RShown() ? 0 : satLayers.far ? 1 : 0;
  // the orbit rings: not on the first screen (they cut through the title) nor right next to the satellite
  // the orbit rings fade out below ~8,000 km: from close to the Earth they only cross the view as stray hairlines
  const camAlt = camera.position.length() - R, ringA = THREE.MathUtils.smoothstep(camAlt, 7000, 14000);
  if (tracks) { tracks.visible = !!satState.started && !paksatClose() && ringA > 0.01; tracks.material.opacity = 0.35 * ringA; }
  const now = performance.now(), step = Math.min(1, (now - lastVis) / 400); lastVis = now; let moved = false;
  for (let i = 0; i < N; i++) if (vis[i] !== visT[i]) { vis[i] = visT[i] > vis[i] ? Math.min(visT[i], vis[i] + step) : Math.max(visT[i], vis[i] - step); moved = true; }
  if (moved) geo.attributes.aVis.needsUpdate = true;
  if (!pending && (performance.now() - lastAsk > 200 || !A || t < tA || t > tB + 5000)) ask(t, rate);
  if (A) {
    const f = Math.max(0, Math.min(1.5, (t - tA) / Math.max(1, tB - tA)));
    for (let i = 0; i < N; i++) {
      const k = i * 3; if (Number.isNaN(A[k]) || Number.isNaN(B[k])) { if (vis[i]) { vis[i] = visT[i] = 0; geo.attributes.aVis.needsUpdate = true; } continue; }
      p0.set(A[k], A[k + 1], A[k + 2]); p1.set(B[k], B[k + 1], B[k + 2]);
      const r = p0.length() + (p1.length() - p0.length()) * f; p0.lerp(p1, f).setLength(r); // stay on the orbit
      pos[k] = p0.x; pos[k + 1] = p0.y; pos[k + 2] = p0.z;
    }
    geo.attributes.position.needsUpdate = true;
    if (iMM1 >= 0 && !Number.isNaN(pos[iMM1 * 3])) {
      p0.fromArray(pos, iMM1 * 3); satState.mm1Label.pos.copy(p0);
      if (p0.distanceTo(paksatPos) > 2) { paksatPos.copy(p0); satState.onMove?.(); }
      const ll = ecefToLatLon(p0.x, p0.y, p0.z);
      if (!capAt || Math.abs(capAt - ll.lon) > 0.2) { capAt = ll.lon; cap.geometry.dispose(); cap.geometry = capGeometry(ll.lat, ll.lon, 71.4); }
    }
    if (i1R >= 0 && !Number.isNaN(pos[i1R * 3])) satState.r1Label.pos.fromArray(pos, i1R * 3);
  }
  // sample orbits: refresh when the layers change or after 20 min of sim time
  if (Math.abs(t - satState.ringT) > 20 * 60000) { satState.ringT = t; askRings(t); }
  // the coverage disc is for the view from space; it fades out as the camera comes down
  const alt = camera.position.length() - R; capMat.uniforms.uOpacity.value = 0.16 * THREE.MathUtils.smoothstep(alt, 3000, 9000); cap.visible = satState.capOn && alt > 3000;
  // points shrink a little from far away
  satUniforms.uScale.value = Math.max(0.7, Math.min(1.3, 1.6 - Math.log10(Math.max(1, camera.position.length() - R)) * 0.2));
}

// Screen-space pick: nearest visible satellite within 12 px.
const v = new THREE.Vector3(), toCam = new THREE.Vector3();
export function pickSatellite(x, y) {
  let best = -1, bd = 144;
  for (let i = 0; i < N; i++) {
    const model = (i === iMM1 && paksatShown()) || (i === i1R && paksat1RShown()); // 3D models (~64 px), not dots
    if (!vis[i] && !model) continue; v.fromArray(pos, i * 3);
    toCam.copy(camera.position).sub(v); if (v.lengthSq() < (R + 3000) ** 2 && toCam.dot(v) < 0) continue; // behind the Earth
    v.project(camera); if (v.z > 1) continue;
    const sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight, d = (sx - x) ** 2 + (sy - y) ** 2;
    if (d < (model ? Math.max(bd, 40 * 40) : bd)) { bd = d; best = i; }
  }
  return best < 0 ? null : satDescribe(best);
}

export function satDescribe(i) {
  const s = list[i];
  return { name: s.name, norad: s.norad, sat: true, index: i, describe: () => {
    const live = () => { const p = new THREE.Vector3().fromArray(pos, i * 3); const ll = ecefToLatLon(p.x, p.y, p.z); return [['Now over', `${ll.lat.toFixed(1)}°, ${ll.lon.toFixed(1)}°`], ['Height', `${Math.round(ll.alt).toLocaleString()} km`]]; };
    const base = [['NORAD id', s.norad], ['COSPAR id', s.omm.OBJECT_ID], ['Orbit data epoch', String(s.omm.EPOCH).slice(0, 16)], ['Snapshot fetched', String(SNAP.fetched).slice(0, 10)]];
    const info = SAT_INFO[s.norad];
    if (info) return { ...info, expert: () => [...info.facts, ...live(), ...base, ['Source', 'Orbital data: CelesTrak']] };
    const role = s.g.role === 'soon' ? 'soon' : s.g.role;
    return { ...GROUP_INFO[role](s.g, satMeta.groups[s.key]), kick: `${GROUP_INFO[role](s.g, satMeta.groups[s.key]).kick} · ${s.name}`, expert: () => [...live(), ...base, ['Source', 'Orbital data: CelesTrak']] };
  } };
}
export const findSat = norad => { const i = list.findIndex(s => s.norad === norad); return i < 0 ? null : satDescribe(i); };
export const firstOfGroup = key => { const i = list.findIndex(s => s.key === key); return i < 0 ? null : satDescribe(i); };
export const satPosition = i => new THREE.Vector3().fromArray(pos, i * 3);
export const satCount = () => N;

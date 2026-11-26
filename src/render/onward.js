// Submarine cables, drawn along their real routes (scripts/fetch-cables.mjs, TeleGeography)
// all the way to a real landing point abroad: Marseille, Singapore, Hong Kong, Mombasa …
// The simulator's cable hop ends at a sea point off Oman / India / Somalia; here the drawn hop
// follows the real route up to that point, and the rest of the route continues from it in the
// same style. Parcels that finish the hop carry on as "couriers" at the cable's own speed and are
// absorbed at the destination with a pulse. Render-only: the simulator's lengths and delays stay.
import * as THREE from 'three';
import DATA from '../data/cables.json';
import { greatCircle, gcDistance, flatToLatLon } from '../geo/globe.js';
import { fromLatLon, faceUp, setRoadGeometry, sampleRoad } from './geo3.js';
import { layers, renderer, fatSegs } from './scene.js';
import { addLabel } from './labels.js';
import { burst } from './fx.js';

export const CABLE_CREDIT = DATA.credit;
// cable id → { dir → { gpts (globe points from the split to the destination), cum, dest } }
export const ONWARD_BY_CABLE = {};
const DESTS = new Map(); // destination name → { name, pos }

// [lon, lat, …] → globe points, densified along great circles (≤ ~60 km steps) so long legs hug the sphere
function densify(ll) {
  const out = [];
  for (let i = 0; i < ll.length; i++) {
    if (i > 0) { const n = Math.max(2, Math.ceil(gcDistance(ll[i - 1][1], ll[i - 1][0], ll[i][1], ll[i][0]) / 60)); greatCircle(ll[i - 1][1], ll[i - 1][0], ll[i][1], ll[i][0], n).slice(1, -1).forEach(([la, lo]) => out.push([lo, la])); }
    out.push(ll[i]);
  }
  return out;
}
const cumOf = pts => { const c = new Float32Array(pts.length); for (let i = 1; i < pts.length; i++) c[i] = c[i - 1] + pts[i].distanceTo(pts[i - 1]); return c; };

// Called by drawNetwork for every submarine cable hop (e: landing station → sea point).
// Returns false if there is no route for it (it keeps the simulator's own drawing).
export function routeCable(e, nodes) {
  const c = DATA.cables[e.cable.id], route = c?.routes[e.dir]; if (!route) return false;
  const a = flatToLatLon(nodes[e.a].pos.x, nodes[e.a].pos.y), b = flatToLatLon(nodes[e.b].pos.x, nodes[e.b].pos.y);
  const pts = lineOf(route, a);
  const s = closest(pts, b); // split where the route passes closest to the simulator's sea point
  setRoadGeometry(e, pts.slice(0, s + 1).flat());
  const on = ONWARD_BY_CABLE[e.cable.id] ||= {};
  e.onward = on[e.dir] = onward(pts.slice(s), c.dest[e.dir], c.approx);
  // westbound cables also stop in the Gulf (Fujairah) for traffic that ends there
  if (e.dir === 'W' && c.routes.G) { const g = lineOf(c.routes.G, a); e.onwardGulf = on.G = onward([pts[s], ...g.slice(closest(g, b) + 1)], c.dest.G, c.approx); }
  return true;
}
function lineOf(route, start) {
  const ll = []; for (let i = 0; i < route.length; i += 2) ll.push([route[i], route[i + 1]]);
  ll[0] = [start.lon, start.lat]; // start exactly at our landing station
  return densify(ll);
}
function closest(pts, p) { let s = 1, best = Infinity; pts.forEach(([lo, la], i) => { const d = gcDistance(la, lo, p.lat, p.lon); if (i > 0 && d < best) { best = d; s = i; } }); return s; }
function onward(ll, dest, approx) {
  const g = ll.map(([lo, la]) => fromLatLon(la, lo));
  if (!DESTS.has(dest.name)) DESTS.set(dest.name, { name: dest.name, pos: fromLatLon(dest.lat, dest.lon) });
  return { gpts: g, cum: cumOf(g), dest: DESTS.get(dest.name), approx: approx || null };
}

// The onward lines (three draw calls: live, landed, retired) and the destinations (one instanced mesh).
let marks = null; const markPos = [];
export function drawOnward(cableEdges, group) {
  const style = { live: [[], { color: 0x8fc3e6, linewidth: 1.4, opacity: 0.8 }], landed: [[], { color: 0x8fc3e6, linewidth: 1.0, opacity: 0.45, dashed: true, dashSize: 8, gapSize: 6 }], retired: [[], { color: 0x8a949a, linewidth: 1.0, opacity: 0.45, dashed: true, dashSize: 8, gapSize: 6 }] };
  for (const e of cableEdges) {
    const segs = style[e.cable.status]?.[0] || style.live[0];
    for (const o of [e.onward, e.onwardGulf]) if (o) for (let i = 1; i < o.gpts.length; i++) segs.push({ a: o.gpts[i - 1], b: o.gpts[i] });
  }
  for (const [segs, o] of Object.values(style)) if (segs.length) group.add(fatSegs(segs, o));
  // a small landing station at each destination: a low hall with a mast (Phase 3 brings detailed models)
  const hall = new THREE.BoxGeometry(1, 0.62, 0.42).translate(0, 0, 0.21), mast = new THREE.CylinderGeometry(0.05, 0.07, 1.1, 6).rotateX(Math.PI / 2).translate(0.32, 0.12, 0.55);
  const geo = mergeTwo(hall, mast);
  marks = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.55, metalness: 0.15, emissive: 0x24465a, emissiveIntensity: 0.6, transparent: true }), DESTS.size);
  marks.frustumCulled = false; marks.renderOrder = 6;
  for (const d of DESTS.values()) { markPos.push(d.pos); addLabel(d.name, d.pos, { cls: 'intl', minR: 1500, maxR: 30000, prio: 4, key: 'dest:' + d.name }); }
  group.add(marks); placeMarks(1);
}
function mergeTwo(a, b) {
  const g = new THREE.BufferGeometry(), A = a.toNonIndexed(), B = b.toNonIndexed();
  for (const k of ['position', 'normal']) { const x = A.attributes[k].array, y = B.attributes[k].array, z = new Float32Array(x.length + y.length); z.set(x); z.set(y, x.length); g.setAttribute(k, new THREE.BufferAttribute(z, 3)); }
  return g;
}
const m4 = new THREE.Matrix4(), o3 = new THREE.Object3D();
// Destinations keep a steady size on screen (~14 px), like the other network markers.
function placeMarks(kmPerPx) {
  markPos.forEach((p, i) => { faceUp(o3, p); o3.scale.setScalar(Math.max(0.03, 14 * kmPerPx)); o3.updateMatrix(); marks.setMatrixAt(i, o3.matrix); });
  marks.instanceMatrix.needsUpdate = true;
}

// ---------- couriers: parcels carrying on past the simulator's sea point ----------
const MAXC = 96, cPos = new Float32Array(MAXC * 3), cCol = new Float32Array(MAXC * 3), cAlpha = new Float32Array(MAXC);
const cGeo = new THREE.BufferGeometry();
cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3)); cGeo.setAttribute('aColor', new THREE.BufferAttribute(cCol, 3)); cGeo.setAttribute('aAlpha', new THREE.BufferAttribute(cAlpha, 1));
const cMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: { uPR: { value: renderer.getPixelRatio() } },
  vertexShader: `attribute vec3 aColor; attribute float aAlpha; uniform float uPR; varying vec3 vC; varying float vA; void main(){ vC=aColor; vA=aAlpha; gl_PointSize = 6.5 * uPR; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `varying vec3 vC; varying float vA; void main(){ float r=length(gl_PointCoord-.5)*2.; if(r>1.) discard; float core=1.-smoothstep(0.,.45,r), halo=1.-smoothstep(.2,1.,r); gl_FragColor=vec4(mix(vC,vec3(1.),core*.55), halo*vA); }`
});
const couriers = []; let cPoints = null;
const v = new THREE.Vector3(), col = new THREE.Color();

// A bundle finished its cable hop at the sea point: send a courier on along the cable.
// speed: the parcel's speed on that hop, in km per unit of network time (real propagation).
export function sendOnward(e, color, speed, gulf = false) {
  const o = (gulf && e.onwardGulf) || e.onward; if (!o || o.gpts.length < 2) return;
  if (!cPoints) { cPoints = new THREE.Points(cGeo, cMat); cPoints.frustumCulled = false; cPoints.renderOrder = 10; layers.packets.add(cPoints); }
  if (couriers.length >= MAXC) couriers.shift();
  const len = o.cum[o.cum.length - 1];
  couriers.push({ o, len, t: 0, dur: len / Math.max(1e-9, speed), c: col.set(color).toArray() });
}
const edgeLike = { gpts: null, gcum: null };
// Advance by network time (couriers pause and speed up with the simulation) and size the markers.
export function updateOnward(netDt, kmPerPx) {
  if (marks) placeMarks(kmPerPx);
  if (!cPoints) return;
  let j = 0;
  for (let i = couriers.length - 1; i >= 0; i--) {
    const k = couriers[i]; k.t += netDt; const f = k.t / k.dur;
    if (f >= 1) { burst(k.o.dest.pos, '#8fd3ff', 0.16, 0.7); couriers.splice(i, 1); continue; } // absorbed at the landing station
  }
  for (const k of couriers) {
    edgeLike.gpts = k.o.gpts; edgeLike.gcum = k.o.cum; sampleRoad(edgeLike, k.t / k.dur, v);
    cPos.set([v.x, v.y, v.z], j * 3); cCol.set(k.c, j * 3); cAlpha[j] = Math.min(1, (1 - k.t / k.dur) * 12); j++; // a quick fade into the station
  }
  cGeo.setDrawRange(0, j);
  for (const a of ['position', 'aColor', 'aAlpha']) cGeo.attributes[a].needsUpdate = true;
}
export const clearCouriers = () => { couriers.length = 0; cGeo.setDrawRange(0, 0); };
export const courierCount = () => couriers.length;

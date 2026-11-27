// Representative 3D models at the network's sites (docs/ROUND2.md §3): landing stations, exchanges
// (IXPs), data centres, satellite ground stations, city exchanges (core routers), the offices with their
// network rooms, the KKH microwave towers and the Khunjerab Pass. Built in code (models/), placed in a
// local East-North-Up frame in metres, shown only when the camera is close enough for them to be more
// than a speck, faded in and out, and freed when the camera leaves. Each model is ≤ 5 draw calls.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { latLonToEcef, enuBasis, gcDistance, flatToLatLon } from '../geo/globe.js';
import { scene, renderer, lightState, camera } from './scene.js';
import { pose, altitudeKm } from './globecam.js';
import { fadeIn, fadeOut } from './fade3d.js';
import * as M from './models/buildings.js';
import { destinationSites } from './onward.js';

const SHOW_ALT = 14; // km: models appear below this camera height
const sites = []; // { key, lat, lon, rot, make, group, leds, office }
export const landmarkState = { shown: 0, activity: null }; // activity(officeKey) → 0..1, set by main

// A group in the local East-North-Up frame at (lat, lon), in metres, turned by rot about the vertical.
function enuGroup(lat, lon, rot = 0) {
  const g = new THREE.Group(), { e, n, u } = enuBasis(lat, lon), o = latLonToEcef(lat, lon, 0);
  g.matrixAutoUpdate = false;
  g.matrix.set(e[0], n[0], u[0], o[0], e[1], n[1], u[1], o[1], e[2], n[2], u[2], o[2], 0, 0, 0, 1)
    .multiply(new THREE.Matrix4().makeRotationZ(rot)).multiply(new THREE.Matrix4().makeScale(0.001, 0.001, 0.001)); // metres → km
  return g;
}
// azimuth / elevation (degrees) from (lat, lon) to an ECEF point (km)
function azEl(lat, lon, p) {
  const o = latLonToEcef(lat, lon, 0), { e, n, u } = enuBasis(lat, lon), d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
  const E = d[0] * e[0] + d[1] * e[1] + d[2] * e[2], N = d[0] * n[0] + d[1] * n[1] + d[2] * n[2], U = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
  return { az: (Math.atan2(E, N) * 180 / Math.PI + 360) % 360, el: Math.atan2(U, Math.hypot(E, N)) * 180 / Math.PI };
}
const llOf = n => (n.lat != null && n.tier === 'cls' ? { lat: n.lat, lon: n.lon } : flatToLatLon(n.pos.x, n.pos.y));

export function initLandmarks(G, offices) {
  // image-based lighting for the models' metal and glass (a neutral studio, generated: nothing to download)
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  const sat = latLonToEcef(0, 38.2, 35786); // PakSat-MM1
  const add = (key, ll, make, rot = 0, extra = {}) => sites.push({ key, lat: ll.lat, lon: ll.lon, rot, make, group: null, ...extra });
  let v = 0;
  for (const n of G.nodes) {
    const ll = llOf(n);
    if (n.tier === 'cls' && !n.planned) {
      // seaward: the first stretch of this station's cable, in the local frame
      const e = G.cableEdges.find(c => c.a === n.id && c.gpts?.length > 2);
      let sea = -Math.PI / 2; if (e) { const q = e.gpts[Math.min(e.gpts.length - 1, 3)], { e: E, n: N } = enuBasis(ll.lat, ll.lon), o = latLonToEcef(ll.lat, ll.lon, 0); const d = [q.x - o[0], q.y - o[1], q.z - o[2]]; sea = Math.atan2(d[0] * N[0] + d[1] * N[1] + d[2] * N[2], d[0] * E[0] + d[1] * E[1] + d[2] * E[2]); }
      add('cls:' + n.id, ll, () => M.landingStation({ seaward: sea, variant: v++ }));
    } else if (n.tier === 'ixp') add('ixp:' + n.id, ll, () => M.dataCentre({ size: 1, sign: 0xe8c35a }), 0.3);
    else if (n.tier === 'dc') add('dc:' + n.id, ll, () => M.dataCentre({ size: /Tier III/.test(n.name) ? 1.6 : 1.2, sign: 0xb9a3f0 }), -0.4);
    else if (n.tier === 'gw') { const { az, el } = azEl(ll.lat, ll.lon, sat); add('gw:' + n.id, ll, () => M.groundStation({ az, el }), 0); }
    else if (n.tier === 'core') add('core:' + n.id, offset(ll, 900, 700), () => M.exchange(), 0.2); // beside the city centre
    else if (n.tier === 'tower') {
      const nb = (G.adj.get(n.id) || []).map(e => G.nodes[e.a === n.id ? e.b : e.a]).map(llOf); // the towers either side
      const az = nb.map(p => azEl(ll.lat, ll.lon, latLonToEcef(p.lat, p.lon, 0)).az);
      add('tower:' + n.id, ll, () => M.latticeTower({ prevAz: az[0] ?? 0, nextAz: az[1] ?? 180 }));
    } else if (n.name === 'Khunjerab Pass') add('kp', ll, () => M.khunjerab(), 0.6);
  }
  for (const o of offices) add('office:' + o.key, { lat: o.lat, lon: o.lon }, () => M.office({ name: o.name }), 0, { office: o.key });
  beacons(offices);
  // abroad, where the cables and border roads end (onward.js): a landing station facing the way its cable
  // comes in, or across a border the neighbour's exchange
  for (const d of destinationSites()) {
    if (d.kind === 'land') { add('dest:' + d.name, d, () => M.exchange(), 0.3); continue; }
    const { az } = azEl(d.lat, d.lon, latLonToEcef(d.toward.lat, d.toward.lon, 0));
    add('dest:' + d.name, d, () => M.landingStation({ seaward: (90 - az) * Math.PI / 180, variant: v++ }));
  }
}
const offset = (ll, eastM, northM) => ({ lat: ll.lat + northM / 110540, lon: ll.lon + eastM / (111320 * Math.cos(ll.lat * Math.PI / 180)) });

// Places where the city's OpenStreetMap buildings make room for a model: [{ lat, lon, r (m) }].
export const clearZones = () => sites.map(s => ({ lat: s.lat, lon: s.lon, r: s.office ? 34 : 60 })); // half the plot, m

function show(s) {
  const r = s.make(), kit = r.kit || r; s.group = enuGroup(s.lat, s.lon, s.rot);
  const body = kit.build(); s.group.add(body);
  if (r.leds) { // the rack's status lights: small boxes whose colours follow the office's traffic
    const g = new THREE.BoxGeometry(0.05, 0.05, 0.05), geos = r.leds.map(([x, y, z]) => g.clone().translate(x, y, z));
    const merged = mergeBoxes(geos); g.dispose();
    s.leds = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true })); s.group.add(s.leds); s.ledN = r.leds.length;
  }
  scene.add(s.group); s.group.updateMatrixWorld(true); fadeIn(s.group, 600);
}
function hide(s) {
  const g = s.group; s.group = null; s.leds = null;
  fadeOut(g, 500, () => { scene.remove(g); g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); });
}
function mergeBoxes(list) {
  const n = list.reduce((a, g) => a + g.toNonIndexed().attributes.position.count, 0), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0; for (const g of list) { const p = g.toNonIndexed().attributes.position.array; pos.set(p, o); o += p.length; g.dispose(); }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('color', new THREE.BufferAttribute(col, 3)); m.userData.per = n / list.length; return m;
}

// A soft warm beam above each office so it can be found among the city's buildings from a few hundred
// metres up to ~200 km; it gets taller and wider with height and is gone right next to the office.
let beam = null; const o3 = new THREE.Object3D(), up = new THREE.Vector3(0, 0, 1);
function beacons(offices) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5); // unit, along z from 0 to 1
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uA: { value: 0 } },
    vertexShader: `varying float vUp; void main(){ vUp = position.z; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uA; varying float vUp; void main(){ gl_FragColor = vec4(vec3(.94,.66,.32) * pow(1. - vUp, 1.6) * uA, 1.); }`
  });
  beam = new THREE.InstancedMesh(geo, mat, offices.length); beam.frustumCulled = false; beam.renderOrder = 7;
  beam.userData.at = offices.map(o => new THREE.Vector3(...latLonToEcef(o.lat, o.lon, 0.03)));
  scene.add(beam);
}
function placeBeacons() {
  const alt = altitudeKm, a = THREE.MathUtils.smoothstep(alt, 0.25, 0.6) * (1 - THREE.MathUtils.smoothstep(alt, 150, 300));
  beam.material.uniforms.uA.value = 0.75 * a; beam.visible = a > 0.01; if (!beam.visible) return;
  const kmPerPx = 2 * pose.range * Math.tan(camera.fov * Math.PI / 360) / innerHeight, r = 2.2 * kmPerPx, h = Math.min(8, Math.max(0.12, alt * 0.18));
  beam.userData.at.forEach((p, i) => { o3.position.copy(p); o3.quaternion.setFromUnitVectors(up, p.clone().normalize()); o3.scale.set(r, r, h); o3.updateMatrix(); beam.setMatrixAt(i, o3.matrix); });
  beam.instanceMatrix.needsUpdate = true;
}

let last = 0;
const GREEN = [0.25, 0.95, 0.45], AMBER = [1, 0.7, 0.15], OFF = [0.08, 0.1, 0.09];
export function updateLandmarks() {
  const now = performance.now();
  if (beam) placeBeacons();
  if (now - last > 400) {
    last = now; let n = 0;
    for (const s of sites) {
      const d = gcDistance(pose.lat, pose.lon, s.lat, s.lon), near = altitudeKm < SHOW_ALT && d < Math.max(4, altitudeKm * 2.2);
      if (near && !s.group) show(s); else if (!near && s.group && (altitudeKm > SHOW_ALT * 1.3 || d > Math.max(6, altitudeKm * 3))) hide(s);
      if (s.group) { n++; s.group.traverse(o => { if (o.material && 'envMapIntensity' in o.material) o.material.envMapIntensity = (o.material.userData.env ??= o.material.envMapIntensity) * (0.12 + 0.88 * lightState.day); }); } // reflections dim at night
    }
    landmarkState.shown = n;
  }
  // blinking rack lights: more lit, more amber, the busier the office is
  for (const s of sites) if (s.leds) {
    const a = landmarkState.activity?.(s.office) ?? 0.3, c = s.leds.geometry.attributes.color, per = s.leds.geometry.userData.per;
    for (let i = 0; i < s.ledN; i++) {
      const on = Math.sin(now * 0.004 * (1 + (i % 5)) + i * 1.7) * 0.5 + 0.5 < 0.25 + a * 0.7, col = !on ? OFF : (i % 9 === 8 && a > 0.7 ? AMBER : GREEN);
      for (let v = 0; v < per; v++) c.array.set(col, (i * per + v) * 3);
    }
    c.needsUpdate = true;
  }
}

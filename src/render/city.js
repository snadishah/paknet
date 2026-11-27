// City views: OpenStreetMap buildings around each illustrative office, baked by
// scripts/fetch-buildings.mjs and loaded only when the camera comes down to the
// city. Each city is one merged mesh (calm grey-white) plus the office building
// (highlighted): 2 draw calls. Geometry lives in a local East-North-Up frame in
// metres inside a group placed at the office (scale 0.001 → km), so there is no
// float jitter at 300 m. Everything is disposed when the camera leaves.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { latLonToEcef, enuBasis, gcDistance } from '../geo/globe.js';
import { scene } from './scene.js';
import { pose, altitudeKm } from './globecam.js';
import { clearZones } from './landmarks.js';
import { globeUniforms } from './globe.js';
const tmpUp = new THREE.Vector3();

const SHOW_KM = 30, HIDE_KM = 70; // altitude where a city appears / is unloaded
export const cityState = { loaded: {}, failed: {}, onStatus: null };
export const cityBusy = () => Object.values(groups).some(g => g.loading); // the loading spinner
const groups = {};

function enuGroup(lat, lon) {
  const g = new THREE.Group(), { e, n, u } = enuBasis(lat, lon), o = latLonToEcef(lat, lon, 0);
  g.matrixAutoUpdate = false;
  g.matrix.set(e[0], n[0], u[0], o[0], e[1], n[1], u[1], o[1], e[2], n[2], u[2], o[2], 0, 0, 0, 1)
    .multiply(new THREE.Matrix4().makeScale(0.001, 0.001, 0.001)); // metres → km
  return g;
}

// Karachi-ish plaster and concrete tones; each building gets one, varied by the façade shader below
const PALETTE = [0xcfc8b8, 0xc4baa5, 0xbab7b0, 0xcbbfab, 0xb2aa98, 0xd6cfc2, 0xc0b7a4, 0xb8bcbd].map(c => new THREE.Color(c));
function tint(g, c) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
// Procedural façades: windows by floor (3.3 m) and bay (3.2 m) on the walls, a darker plinth, concrete
// roofs; at night about a third of the windows are lit. Local coordinates are metres (East-North-Up).
function facadeMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02, envMapIntensity: 0.35, transparent: true, opacity: 0 });
  m.userData.uNight = { value: 0 };
  m.onBeforeCompile = sh => {
    sh.uniforms.uNight = m.userData.uNight;
    sh.vertexShader = 'varying vec3 vLoc; varying vec3 vNl;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLoc = position; vNl = normal;');
    sh.fragmentShader = 'varying vec3 vLoc; varying vec3 vNl; uniform float uNight;\nfloat h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 nL = normalize(vNl); float roof = step(0.5, nL.z);
        float u = dot(vLoc.xy, vec2(-nL.y, nL.x)); vec2 cell = vec2(floor(u / 3.2), floor(vLoc.z / 3.3)), fr = vec2(fract(u / 3.2), fract(vLoc.z / 3.3));
        float win = (1.0 - roof) * step(2.6, vLoc.z) * step(0.22, fr.x) * step(fr.x, 0.78) * step(0.3, fr.y) * step(fr.y, 0.76);
        // far away a window is smaller than a pixel: blend to the average instead of shimmering
        float aa = clamp(1.6 - 2.5 * max(fwidth(u / 3.2), fwidth(vLoc.z / 3.3)), 0.0, 1.0); win = mix((1.0 - roof) * 0.24, win, aa);
        vec3 wall = diffuseColor.rgb * (0.72 + 0.28 * smoothstep(0.0, 4.0, vLoc.z)) * (0.94 + 0.06 * h21(floor(vLoc.xy / 9.0)));
        vec3 glassC = vec3(0.13, 0.16, 0.19) + 0.07 * h21(cell);
        vec3 roofC = diffuseColor.rgb * 0.8 * (0.9 + 0.1 * h21(floor(vLoc.xy / 3.0)));
        diffuseColor.rgb = mix(mix(wall, glassC, win), roofC, roof);
        float winLit = win * step(h21(cell + 17.3), 0.33);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.0, 0.78, 0.46) * winLit * uNight * 0.85;');
  };
  return m;
}

function buildCity(data, at) {
  const geos = [];
  // make room for the 3D models (landmarks.js): their sites in this city's local frame, metres
  const room = clearZones().map(z => ({ x: (z.lon - at.lon) * 111320 * Math.cos(at.lat * Math.PI / 180), y: (z.lat - at.lat) * 110540, r: z.r })).filter(z => Math.hypot(z.x, z.y) < 5000);
  data.b.forEach((row, i) => {
    const h = row[0], pts = []; for (let k = 1; k < row.length; k += 2) pts.push(new THREE.Vector2(row[k], row[k + 1]));
    if (i === data.officeIndex) return; // the office is a detailed model now
    let cx = 0, cy = 0; pts.forEach(p => { cx += p.x; cy += p.y; }); cx /= pts.length; cy /= pts.length;
    if (room.some(z => Math.abs(cx - z.x) < z.r && Math.abs(cy - z.y) < z.r)) return;
    try {
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: h, bevelEnabled: false, curveSegments: 1 });
      g.deleteAttribute('uv'); tint(g, PALETTE[(i * 7 + (h | 0)) % PALETTE.length]); geos.push(g);
    } catch { /* skip a bad footprint */ }
  });
  const g = new THREE.Group();
  if (geos.length) { const merged = mergeGeometries(geos); geos.forEach(x => x.dispose()); const m = new THREE.Mesh(merged, facadeMaterial()); m.renderOrder = 2; g.add(m); }
  g.userData.meshes = g.children;
  return g;
}

async function load(office) {
  const k = office.key; if (groups[k] || cityState.failed[k]) return;
  groups[k] = { loading: true };
  try {
    const r = await fetch(`assets/cities/${k}.json`); if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    if (!groups[k]?.loading) return; // left while loading
    const g = enuGroup(office.lat, office.lon); g.add(buildCity(data, office));
    g.userData.office = office; g.userData.shown = performance.now(); g.updateMatrixWorld(true);
    scene.add(g); groups[k] = g; cityState.loaded[k] = data.b.length; cityState.onStatus?.(k, true);
  } catch { delete groups[k]; cityState.failed[k] = true; cityState.onStatus?.(k, false); }
}

// leaving a city: its buildings fade out (0.5 s, in updateCity), then are freed
function unload(k) {
  const g = groups[k]; if (!g || g.loading) { delete groups[k]; return; }
  g.userData.leaving ??= performance.now();
}
function free(k) {
  const g = groups[k];
  scene.remove(g); g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  delete groups[k]; delete cityState.loaded[k];
}

let lastCheck = 0;
export function updateCity(offices) {
  const now = performance.now();
  if (now - lastCheck > 300) {
    lastCheck = now;
    for (const o of offices) {
      const dKm = gcDistance(pose.lat, pose.lon, o.lat, o.lon);
      if (altitudeKm < SHOW_KM && dKm < 40) { if (groups[o.key]?.userData?.leaving) groups[o.key].userData.leaving = null; load(o); } // came back while it faded: keep it
      else if (groups[o.key] && (altitudeKm > HIDE_KM || dKm > 120)) unload(o.key);
    }
  }
  // fade in over 0.8 s, and with altitude between 30 and 15 km
  for (const g of Object.values(groups)) {
    if (!g.children?.[0]?.userData?.meshes) continue; // still loading
    const out = g.userData.leaving ? 1 - (now - g.userData.leaving) / 500 : 1;
    if (out <= 0) { free(Object.keys(groups).find(k => groups[k] === g)); continue; }
    const a = Math.min(1, (now - g.userData.shown) / 800) * (1 - THREE.MathUtils.smoothstep(altitudeKm, 15, SHOW_KM)) * out;
    g.visible = a > 0.01;
    // always in the transparent pass, so they draw after the ground tiles (which skip the depth test)
    // night at this city: the sun below its horizon lights the windows
    const o = g.userData.office, up = tmpUp.set(...latLonToEcef(o.lat, o.lon, 0)).normalize(), night = 1 - THREE.MathUtils.smoothstep(up.dot(globeUniforms.uSun.value), -0.08, 0.12);
    for (const m of g.children[0].userData.meshes) { m.material.opacity = a; m.material.depthWrite = a > 0.5; if (m.material.userData.uNight) m.material.userData.uNight.value = night; m.material.envMapIntensity = 0.35 * (0.12 + 0.88 * (1 - night)); }
  }
}
export const cityLoaded = k => !!groups[k]?.children?.[0]?.userData?.meshes;

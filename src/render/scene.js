// Renderer, camera, fat-line helpers and the layer registry.
// The scene is in kilometres, ECEF axes (geo/globe.js). No shadows, no post-processing.
import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

const app = document.getElementById('app');
export const isPhone = Math.max(innerWidth, innerHeight) < 900 || matchMedia('(pointer: coarse)').matches;
export const quality = { pixelRatio: Math.min(window.devicePixelRatio, 2) };
export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(quality.pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 1);
app.appendChild(renderer.domElement);
// CSS2D renderer only for story callouts; map labels use their own DOM layer (labels.js).
export const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight); labelRenderer.domElement.className = 'labels'; app.appendChild(labelRenderer.domElement);

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 1, 200000);

// Objects that use light (satellite models, buildings) get a sun lamp and a soft fill.
export const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
export const fillLight = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(sunLight, sunLight.target, fillLight);

// fat lines (screen-space width)
const lineMats = [];
export function lmat(o) { const m = new LineMaterial(Object.assign({ worldUnits: false, transparent: true, depthWrite: false }, o)); m.resolution.set(innerWidth, innerHeight); lineMats.push(m); return m; }
export function forgetLineMat(m) { const i = lineMats.indexOf(m); if (i >= 0) lineMats.splice(i, 1); }
const flat3 = pts => { const a = new Float32Array(pts.length * 3); pts.forEach((p, i) => { a[i * 3] = p.x; a[i * 3 + 1] = p.y; a[i * 3 + 2] = p.z; }); return a; };
export function fatLine(pts, o) { const g = new LineGeometry(); g.setPositions(flat3(pts)); const l = new Line2(g, lmat(o)); if (o.dashed) l.computeLineDistances(); return l; }
export function fatSegs(segs, o) {
  const g = new LineSegmentsGeometry(); const a = new Float32Array(segs.length * 6);
  segs.forEach((s, i) => { a.set([s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z], i * 6); }); g.setPositions(a);
  if (o.vertexColors) g.setColors(segs.flatMap(s => { const c = new THREE.Color(s.c); return [c.r, c.g, c.b, c.r, c.g, c.b]; }));
  const l = new LineSegments2(g, lmat(o)); if (o.dashed) l.computeLineDistances(); return l;
}
export function disposeLine(l) { l.geometry.dispose(); l.material.dispose(); forgetLineMat(l.material); }

// Layers are groups toggled from the Layers menu. Creation order is draw order
// for transparent objects, so keep it stable. Network layers live in netRoot,
// which is scaled slightly above the ground (setLift).
export const layers = {};
export const netRoot = new THREE.Group(); netRoot.name = 'network'; scene.add(netRoot);
export function layer(name, vis = true, parent = netRoot) { const g = new THREE.Group(); g.name = name; g.visible = vis; parent.add(g); layers[name] = g; return g; }

// Lift the network above the globe by liftKm (a scale about the Earth's centre).
export function setLift(liftKm) { netRoot.scale.setScalar(1 + liftKm / 6371); }

// Near/far planes follow the camera altitude so depth precision holds from 300 m to GEO.
export function fitClipPlanes(altKm, distToCentre) {
  const near = Math.max(0.02, altKm * 0.04), far = distToCentre + 6371 + 48000;
  if (Math.abs(camera.near - near) / near > 0.02 || Math.abs(camera.far - far) > 100) { camera.near = near; camera.far = far; camera.updateProjectionMatrix(); }
}

const resizeFns = [];
export const onResize = fn => resizeFns.push(fn);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); labelRenderer.setSize(innerWidth, innerHeight);
  lineMats.forEach(m => m.resolution.set(innerWidth, innerHeight));
  resizeFns.forEach(f => f());
});

export function setPixelRatio(pr) { quality.pixelRatio = pr; renderer.setPixelRatio(pr); resizeFns.forEach(f => f()); }

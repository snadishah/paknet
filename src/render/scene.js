// Renderer, camera, lights, fat-line helpers and the layer registry.
// Shadows on, no post-processing.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

const app = document.getElementById('app');
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0xe4eae8, 1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);
export const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight); labelRenderer.domElement.className = 'labels'; app.appendChild(labelRenderer.domElement);

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 400);
camera.up.set(0, 0, 1); camera.position.set(0, -30, 40);
export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = false;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.maxPolarAngle = 1.15; controls.minDistance = 1.2; controls.maxDistance = 60;
controls.target.set(0, -1, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0xaab8b0, 2.1));
const sun = new THREE.DirectionalLight(0xfff8ee, 2.4);
sun.position.set(-7, -10, 16); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 });
sun.shadow.bias = -0.0004; sun.shadow.radius = 3; scene.add(sun);

// fat lines (screen-space width)
const lineMats = [];
export function lmat(o) { const m = new LineMaterial(Object.assign({ worldUnits: false, transparent: true, depthWrite: false }, o)); m.resolution.set(innerWidth, innerHeight); lineMats.push(m); return m; }
export function fatLine(pts, o) { const g = new LineGeometry(); g.setPositions(pts.flatMap(p => [p.x, p.y, p.z])); const l = new Line2(g, lmat(o)); if (o.dashed) l.computeLineDistances(); return l; }
export function fatSegs(segs, o) {
  const g = new LineSegmentsGeometry(); g.setPositions(segs.flatMap(s => [s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z]));
  if (o.vertexColors) g.setColors(segs.flatMap(s => { const a = new THREE.Color(s.c); return [a.r, a.g, a.b, a.r, a.g, a.b]; }));
  const l = new LineSegments2(g, lmat(o)); if (o.dashed) l.computeLineDistances(); return l;
}

// Layers are scene groups toggled from the Layers pop-up. Creation order is
// draw order for transparent objects, so keep it stable.
export const layers = {};
export function layer(name, vis = true) { const g = new THREE.Group(); g.visible = vis; scene.add(g); layers[name] = g; return g; }

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); labelRenderer.setSize(innerWidth, innerHeight);
  lineMats.forEach(m => m.resolution.set(innerWidth, innerHeight));
});

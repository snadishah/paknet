import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import COUNTRIES from '../data/countries.json';
import PROV from '../data/prov_merged.json';
import CITIES from '../data/cities.json';

/* ---------------- projection ---------------- */
const LON0 = 69.3, LAT0 = 30.2, KX = Math.cos(LAT0 * Math.PI / 180);
const H = 0.30, BEV = 0.018, TOP = H + BEV, NET = TOP + 0.02;
const KM_PER_UNIT = 111;
const P = (lon, lat, z = 0) => new THREE.Vector3((lon - LON0) * KX, lat - LAT0, z);
const unP = (v) => [v.x / KX + LON0, v.y + LAT0];

/* ---------------- palette ---------------- */
const INK = '#22312b';
const PROV_COL = { 'Balochistan': '#a3c9ab', 'Sindh': '#7fb391', 'Punjab': '#5f9f7a', 'Khyber Pakhtunkhwa': '#71ab88', 'Gilgit-Baltistan': '#4e8d6a', 'Azad Kashmir': '#8bbd9b' };
const FLOW = {
  intl: { c: '#f08a00', label: 'International' },
  dom: { c: '#1d4ed8', label: 'Domestic' },
  cdn: { c: '#0891b2', label: 'Local cache (CDN)' },
  sat: { c: '#7c3aed', label: 'Satellite' },
  atk: { c: '#dc2626', label: 'Attack / hijacked' },
  loop: { c: '#d97706', label: 'Routing loop' }
};

/* ---------------- renderer ---------------- */
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0xe4eae8, 1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight); labelRenderer.domElement.className = 'labels'; app.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 400);
camera.up.set(0, 0, 1); camera.position.set(0, -30, 40);
const controls = new OrbitControls(camera, renderer.domElement);
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

const lineMats = [];
function lmat(o) { const m = new LineMaterial(Object.assign({ worldUnits: false, transparent: true, depthWrite: false }, o)); m.resolution.set(innerWidth, innerHeight); lineMats.push(m); return m; }
function fatLine(pts, o) { const g = new LineGeometry(); g.setPositions(pts.flatMap(p => [p.x, p.y, p.z])); const l = new Line2(g, lmat(o)); if (o.dashed) l.computeLineDistances(); return l; }
function fatSegs(segs, o) {
  const g = new LineSegmentsGeometry(); g.setPositions(segs.flatMap(s => [s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z]));
  if (o.vertexColors) g.setColors(segs.flatMap(s => { const a = new THREE.Color(s.c); return [a.r, a.g, a.b, a.r, a.g, a.b]; }));
  const l = new LineSegments2(g, lmat(o)); if (o.dashed) l.computeLineDistances(); return l;
}
const layers = {};
function layer(name, vis = true) { const g = new THREE.Group(); g.visible = vis; scene.add(g); layers[name] = g; return g; }

/* ---------------- basemap ---------------- */
const gBase = layer('base');
const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshLambertMaterial({ color: 0xe1e9e8 }));
ground.receiveShadow = true; gBase.add(ground);
const toShape = (ring) => ring.map(([lo, la]) => { const v = P(lo, la); return new THREE.Vector2(v.x, v.y); });
function polysToShapes(polys) { return polys.map(poly => { const s = new THREE.Shape(toShape(poly[0])); poly.slice(1).forEach(h => s.holes.push(new THREE.Path(toShape(h)))); return s; }); }
const nbMat = new THREE.MeshLambertMaterial({ color: 0xd6ddd6 });
for (const k of ['IND', 'AFG', 'IRN', 'CHN', 'OMN', 'TJK', 'ARE']) {
  if (!COUNTRIES[k]) continue;
  const m = new THREE.Mesh(new THREE.ShapeGeometry(polysToShapes(COUNTRIES[k])), nbMat); m.position.z = 0.004; m.receiveShadow = true; gBase.add(m);
  COUNTRIES[k].forEach(poly => gBase.add(fatLine(poly[0].map(([lo, la]) => P(lo, la, 0.008)), { color: 0xc3ccc5, linewidth: 1, opacity: 1 })));
}
// province slabs
const provMeshes = {};
for (const [name, polys] of Object.entries(PROV)) {
  const geo = new THREE.ExtrudeGeometry(polysToShapes(polys), { depth: H, bevelEnabled: true, bevelThickness: BEV, bevelSize: 0.014, bevelSegments: 2, curveSegments: 1 });
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: PROV_COL[name] }));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.prov = name; gBase.add(mesh); provMeshes[name] = mesh;
  polys.forEach(poly => gBase.add(fatLine(poly[0].map(([lo, la]) => P(lo, la, TOP + 0.002)), { color: 0xffffff, linewidth: 1.2, opacity: 0.55 })));
}
// nearest point on a province boundary (to put landing stations on the coast)
function snapToCoast(prov, lon, lat) {
  const q = P(lon, lat); let best = null, bd = 1e9;
  for (const ring of PROV[prov].map(p => p[0])) for (let i = 0; i < ring.length - 1; i++) {
    const a = P(...ring[i]), b = P(...ring[i + 1]); const ab = b.clone().sub(a); const t = Math.max(0, Math.min(1, q.clone().sub(a).dot(ab) / ab.lengthSq()));
    const c = a.clone().addScaledVector(ab, t); const d = c.distanceTo(q); if (d < bd) { bd = d; best = c; }
  }
  return unP(best);
}

/* ---------------- cities & graph (representative topology) ---------------- */
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const cities = CITIES.map(c => ({ ...c, n: norm(c.n) }));
const EXTRA = {
  Hub: [66.89, 25.05, 90000], Taftan: [61.56, 28.96, 8000], 'Nok Kundi': [62.75, 28.82, 8000], Karimabad: [74.66, 36.32, 15000],
  Sost: [74.82, 36.69, 3000], 'Khunjerab Pass': [75.42, 36.85, 0], Torkham: [71.09, 34.13, 5000], Besham: [72.88, 34.93, 20000],
  Chilas: [74.10, 35.42, 20000], Dasu: [73.29, 35.29, 10000], Kalat: [66.58, 29.03, 20000], Nushki: [66.02, 29.55, 40000],
  Awaran: [65.23, 26.46, 10000], Chitral: [71.79, 35.85, 50000], Rawalakot: [73.76, 33.86, 50000], Dadu: [67.78, 26.73, 150000],
  Kashmore: [69.58, 28.43, 40000], Vehari: [72.35, 30.04, 120000], Khanewal: [71.93, 30.30, 200000]
};
for (const [n, [lon, lat, p]] of Object.entries(EXTRA)) { const ex = cities.find(c => c.n === n); if (ex) { if (!ex.p) ex.p = p; } else cities.push({ n, lon, lat, p }); }

const nodes = [], edges = [], adj = new Map(), byName = {};
function addNode(o) { o.id = nodes.length; o.pos = o.pos || P(o.lon, o.lat, NET); nodes.push(o); adj.set(o.id, []); if (o.name && !byName[o.name]) byName[o.name] = o; return o; }
function addEdge(a, b, type, ops = [], pts = null, extra = {}) {
  if (!a || !b) return null;
  const e = Object.assign({ id: edges.length, a: a.id, b: b.id, type, ops, pts: pts || [a.pos, b.pos], cut: false, load: 0 }, extra);
  e.len = 0; for (let i = 1; i < e.pts.length; i++) e.len += e.pts[i].distanceTo(e.pts[i - 1]);
  edges.push(e); adj.get(a.id).push(e); adj.get(b.id).push(e); return e;
}
const CORE = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Hyderabad', 'Sukkur', 'Gwadar'];
const AGG = ['Gujranwala', 'Sialkot', 'Sargodha', 'Bahawalpur', 'Rahim Yar Khan', 'Sahiwal', 'Okara', 'Kasur', 'Gujrat', 'Jhelum', 'Attock City', 'Mardan', 'Mingora', 'Abbottabad', 'Mansehra', 'Kohat', 'Bannu', 'Dera Ismail Khan', 'Dera Ghazi Khan', 'Muzaffargarh', 'Khanewal', 'Jhang Sadr', 'Chiniot', 'Mianwali', 'Larkana', 'Nawabshah', 'Mirpur Khas', 'Jacobabad', 'Dadu', 'Thatta', 'Badin', 'Umarkot', 'Mithi', 'Kashmore', 'Khuzdar', 'Kalat', 'Mastung', 'Sibi', 'Loralai', 'Zhob', 'Chaman', 'Nushki', 'Dalbandin', 'Nok Kundi', 'Taftan', 'Turbat', 'Panjgur', 'Kharan', 'Pasni', 'Ormara', 'Hub', 'Awaran', 'Muzaffarabad', 'New Mirpur', 'Kotli', 'Rawalakot', 'Gilgit', 'Skardu', 'Chitral', 'Besham', 'Dasu', 'Chilas', 'Karimabad', 'Sost', 'Khunjerab Pass', 'Torkham', 'Shekhupura', 'Vehari'];
const seen = new Set();
for (const c of cities) {
  if (seen.has(c.n)) continue; seen.add(c.n);
  addNode({ name: c.n, lon: c.lon, lat: c.lat, pop: c.p, tier: CORE.includes(c.n) ? 'core' : AGG.includes(c.n) ? 'agg' : 'access', kind: 'city' });
}
const N = n => byName[n];
const R = (names, type, ops) => { for (let i = 0; i < names.length - 1; i++) addEdge(N(names[i]), N(names[i + 1]), type, ops); };
const BIG4 = ['PTCL', 'Multinet', 'Wateen', 'Cybernet'];
R(['Karachi', 'Hyderabad', 'Nawabshah', 'Sukkur', 'Rahim Yar Khan', 'Bahawalpur', 'Multan', 'Khanewal', 'Sahiwal', 'Okara', 'Lahore'], 'fiber', BIG4);
R(['Multan', 'Faisalabad', 'Lahore'], 'fiber', ['PTCL', 'Wateen', 'Cybernet']);
R(['Faisalabad', 'Chiniot', 'Sargodha', 'Islamabad'], 'fiber', ['PTCL', 'Wateen']);
R(['Lahore', 'Gujranwala', 'Gujrat', 'Jhelum', 'Rawalpindi', 'Islamabad'], 'fiber', ['PTCL', 'Multinet', 'Wateen', 'Cybernet', 'Nayatel']);
R(['Islamabad', 'Attock City', 'Peshawar'], 'fiber', ['PTCL', 'Multinet', 'Nayatel']);
R(['Gujranwala', 'Sialkot'], 'fiber', ['PTCL', 'Multinet']);
R(['Lahore', 'Kasur'], 'fiber', ['PTCL']); R(['Lahore', 'Shekhupura', 'Faisalabad'], 'fiber', ['PTCL']);
R(['Multan', 'Vehari'], 'fiber', ['PTCL']); R(['Faisalabad', 'Jhang Sadr', 'Multan'], 'fiber', ['PTCL']);
R(['Hyderabad', 'Dadu', 'Larkana', 'Kashmore', 'Dera Ghazi Khan', 'Dera Ismail Khan', 'Bannu', 'Kohat', 'Peshawar'], 'fiber', ['PTCL', 'Wateen']);
R(['Sukkur', 'Larkana'], 'fiber', ['PTCL']); R(['Multan', 'Muzaffargarh', 'Dera Ghazi Khan'], 'fiber', ['PTCL', 'Multinet']);
R(['Sargodha', 'Mianwali', 'Dera Ismail Khan'], 'fiber', ['PTCL']);
R(['Karachi', 'Hub', 'Khuzdar', 'Kalat', 'Mastung', 'Quetta', 'Chaman'], 'fiber', ['PTCL']);
R(['Quetta', 'Sibi', 'Jacobabad', 'Sukkur'], 'fiber', ['PTCL', 'Wateen']);
R(['Quetta', 'Loralai', 'Dera Ghazi Khan'], 'fiber', ['PTCL']); R(['Quetta', 'Zhob', 'Dera Ismail Khan'], 'fiber', ['PTCL']);
R(['Hub', 'Ormara', 'Pasni', 'Gwadar'], 'fiber', ['PTCL']); R(['Gwadar', 'Turbat', 'Panjgur'], 'fiber', ['PTCL']);
R(['Quetta', 'Nushki', 'Dalbandin', 'Nok Kundi', 'Taftan'], 'fiber', ['PTCL']);
R(['Karachi', 'Thatta', 'Badin', 'Hyderabad'], 'fiber', ['PTCL']); R(['Hyderabad', 'Mirpur Khas', 'Umarkot'], 'fiber', ['PTCL']);
R(['Peshawar', 'Mardan', 'Mingora'], 'fiber', ['PTCL', 'Nayatel']);
R(['Islamabad', 'Muzaffarabad'], 'fiber', ['SCO', 'PTCL']); R(['Jhelum', 'New Mirpur', 'Kotli', 'Rawalakot', 'Muzaffarabad'], 'fiber', ['SCO']);
R(['Rawalpindi', 'Abbottabad', 'Mansehra', 'Besham', 'Dasu', 'Chilas', 'Gilgit', 'Karimabad'], 'fiber', ['SCO']);
R(['Karimabad', 'Sost', 'Khunjerab Pass'], 'aerial', ['SCO']);
R(['Umarkot', 'Mithi'], 'microwave', ['PTCL']); R(['Mingora', 'Chitral'], 'microwave', ['PTCL']);
R(['Gilgit', 'Skardu'], 'microwave', ['SCO']); R(['Panjgur', 'Kharan', 'Nushki'], 'microwave', ['PTCL']); R(['Khuzdar', 'Awaran', 'Turbat'], 'microwave', ['PTCL']);
// microwave backup chain (26 relays Rawalpindi → Karimabad)
const towers = [];
{
  const curve = new THREE.CatmullRomCurve3(['Rawalpindi', 'Abbottabad', 'Mansehra', 'Besham', 'Dasu', 'Chilas', 'Gilgit', 'Karimabad'].map(n => N(n).pos), false, 'catmullrom', 0.2);
  let prev = N('Rawalpindi');
  for (let i = 1; i <= 26; i++) {
    const t = i / 27, p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    const off = new THREE.Vector3(-tan.y, tan.x, 0).normalize().multiplyScalar(0.12);
    const tw = addNode({ name: `Microwave relay ${i}/26`, pos: p.clone().add(off).setZ(NET), tier: 'tower', kind: 'tower', op: 'SCO' });
    towers.push(tw); addEdge(prev, tw, 'mwbackup', ['SCO']); prev = tw;
  }
  addEdge(prev, N('Karimabad'), 'mwbackup', ['SCO']);
}
// Karachi gateway
const coastNode = (name, prov, lon, lat, op, extra = {}) => { const [lo, la] = snapToCoast(prov, lon, lat); return addNode(Object.assign({ name, lon: lo, lat: la, tier: 'cls', kind: 'cls', op }, extra)); };
const CLS = {
  twa: coastNode("TWA landing station · Hawke's Bay", 'Sindh', 66.80, 24.86, 'TWA'),
  ptclHB: coastNode("PTCL landing station · Hawke's Bay", 'Sindh', 66.88, 24.82, 'PTCL'),
  cyber: coastNode('Cybernet landing station (PEACE)', 'Sindh', 66.97, 24.78, 'Cybernet'),
  ptclSV: coastNode('PTCL landing station · Sea View', 'Sindh', 67.06, 24.76, 'PTCL'),
  gwadar: coastNode('Gwadar landing station (planned)', 'Balochistan', 62.33, 25.10, 'SCO', { planned: true })
};
for (const k of ['ptclHB', 'ptclSV', 'twa', 'cyber']) addEdge(CLS[k], N('Karachi'), 'metro', [CLS[k].op]);
addEdge(CLS.gwadar, N('Gwadar'), 'planned', ['SCO']);
const IXP = [['PKIX Islamabad', 'Islamabad', 0.08, 0.06], ['PKIX Karachi', 'Karachi', 0.12, 0.1], ['PKIX Lahore', 'Lahore', 0.09, 0.06]].map(([n, c, dx, dy]) => {
  const city = N(c); const o = addNode({ name: n, pos: city.pos.clone().add(new THREE.Vector3(dx, dy, 0)), tier: 'ixp', kind: 'ixp', lon: city.lon, lat: city.lat }); addEdge(o, city, 'metro', []); o.city = city; return o;
});
const DCS = [['Cloudflare edge · Karachi', 'Karachi', -0.02, 0.15], ['Cloudflare edge · Lahore', 'Lahore', -0.09, 0.06], ['Cloudflare edge · Islamabad', 'Islamabad', -0.09, 0.04], ['TWA Tier III data centre', 'Karachi', -0.15, 0.08]].map(([n, c, dx, dy]) => {
  const city = N(c); const o = addNode({ name: n, pos: city.pos.clone().add(new THREE.Vector3(dx, dy, 0)), tier: 'dc', kind: 'dc', lon: city.lon, lat: city.lat }); addEdge(o, city, 'metro', []); o.city = city; return o;
});
const INTL = {
  W: addNode({ name: 'Gulf · Red Sea · Europe', lon: 59.6, lat: 24.75, tier: 'intl', kind: 'intl' }),
  E: addNode({ name: 'India · Singapore', lon: 71.4, lat: 20.6, tier: 'intl', kind: 'intl' }),
  SW: addNode({ name: 'East Africa', lon: 61.0, lat: 19.6, tier: 'intl', kind: 'intl' }),
  N: addNode({ name: 'China', lon: 76.4, lat: 37.6, tier: 'intl', kind: 'intl' }),
  AF: addNode({ name: 'Afghanistan', lon: 70.0, lat: 34.75, tier: 'intl', kind: 'intl' }),
  AFS: addNode({ name: 'Afghanistan', lon: 65.8, lat: 31.4, tier: 'intl', kind: 'intl', hideLabel: true }),
  IR: addNode({ name: 'Iran', lon: 60.6, lat: 29.5, tier: 'intl', kind: 'intl' })
};
for (const k in INTL) INTL[k].pos.z = 0.03;
addEdge(N('Khunjerab Pass'), INTL.N, 'aerial', ['SCO']);
addEdge(N('Peshawar'), N('Torkham'), 'fiber', ['PTCL']); addEdge(N('Torkham'), INTL.AF, 'xborder', ['PTCL']);
addEdge(N('Chaman'), INTL.AFS, 'xborder', ['PTCL']); addEdge(N('Taftan'), INTL.IR, 'xborder', ['PTCL']);
const CABLES = [
  { id: 'SMW4', name: 'SEA-ME-WE 4', cls: 'ptclHB', op: 'PTCL', dirs: ['W', 'E'], status: 'live', share: 0.13 },
  { id: 'IMEWE', name: 'IMEWE', cls: 'ptclHB', op: 'PTCL', dirs: ['W', 'E'], status: 'live', share: 0.10 },
  { id: 'AAE1', name: 'AAE-1', cls: 'ptclSV', op: 'PTCL', dirs: ['W', 'E'], status: 'live', share: 0.17 },
  { id: 'AFR1', name: 'Africa-1', cls: 'ptclSV', op: 'PTCL', dirs: ['SW'], status: 'landed', share: 0.04 },
  { id: 'SMW5', name: 'SEA-ME-WE 5', cls: 'twa', op: 'TWA', dirs: ['W', 'E'], status: 'live', share: 0.16 },
  { id: 'TW1', name: 'TW1', cls: 'twa', op: 'TWA', dirs: ['W'], status: 'live', share: 0.07 },
  { id: 'SMW6', name: 'SEA-ME-WE 6', cls: 'twa', op: 'TWA', dirs: ['W', 'E'], status: 'live', share: 0.20 },
  { id: '2AFR', name: '2Africa', cls: 'twa', op: 'TWA', dirs: ['SW'], status: 'landed', share: 0.04 },
  { id: 'PEACE', name: 'PEACE', cls: 'cyber', op: 'Cybernet', dirs: ['SW'], status: 'live', share: 0.09 },
  { id: 'SMW3', name: 'SEA-ME-WE 3', cls: 'ptclHB', op: 'PTCL', dirs: ['W'], status: 'retired', share: 0 }
];
const DIR_ROUTE = {
  W: [[66.45, 24.35], [65.0, 24.12], [62.6, 24.3], [59.6, 24.75]],
  E: [[67.0, 24.2], [67.8, 22.9], [69.4, 21.5], [71.4, 20.6]],
  SW: [[66.5, 24.15], [65.2, 22.8], [63.2, 21.0], [61.0, 19.6]]
};
const cableEdges = [];
function seaPath(startTop, ctrlLL, k, d) {
  const down = startTop.clone().setZ(0.02);
  const ctrl = ctrlLL.map(([lo, la], j) => { const f = j === ctrlLL.length - 1 ? 0.15 : 1; const v = P(lo, la, 0.02); if (d === 'W') v.y += k * f; else if (d === 'E') v.x += k * f; else { v.x += k * f * 0.7; v.y -= k * f * 0.7; } return v; });
  const pts = new THREE.CatmullRomCurve3([down, ...ctrl], false, 'centripetal').getPoints(80);
  return [startTop, ...pts];
}
CABLES.forEach((c, i) => {
  c.edges = [];
  for (const d of c.dirs) { const e = addEdge(CLS[c.cls], INTL[d], 'subsea', [c.op], seaPath(CLS[c.cls].pos, DIR_ROUTE[d], (i - 4.5) * 0.06, d), { cable: c, dir: d }); c.edges.push(e); cableEdges.push(e); }
});
const plannedEdges = [];
{
  plannedEdges.push(addEdge(CLS.gwadar, INTL.W, 'planned', ['SCO'], seaPath(CLS.gwadar.pos, [[62.1, 24.75], [60.8, 24.6], [59.6, 24.75]], 0.0, 'W'), { plannedCable: true }));
  const names = ['Rawalpindi', 'Dera Ismail Khan', 'Zhob', 'Quetta', 'Kalat', 'Panjgur', 'Turbat', 'Gwadar'];
  for (let i = 0; i < names.length - 1; i++) { const a = N(names[i]), b = N(names[i + 1]), off = new THREE.Vector3(0.05, -0.05, 0); plannedEdges.push(addEdge(a, b, 'planned', ['SCO'], [a.pos.clone().add(off), b.pos.clone().add(off)])); }
  plannedEdges.push(edges.find(e => e.a === CLS.gwadar.id && e.type === 'planned' && !e.plannedCable));
  plannedEdges.forEach(e => e.planned = true);
}
const SAT = addNode({ name: 'PakSat-MM1 satellite (GEO 38.2°E)', pos: P(62.6, 31.0, 3.6), tier: 'sat', kind: 'sat' });
const GW = ['Karachi', 'Lahore', 'Islamabad'].map(c => { const city = N(c); const g = addNode({ name: `Satellite gateway · ${c}`, pos: city.pos.clone().add(new THREE.Vector3(0.1, -0.08, 0)), tier: 'gw', kind: 'gw', lon: city.lon, lat: city.lat }); addEdge(g, city, 'metro', []); g.city = city; return g; });
const VSAT = ['Chitral', 'Skardu', 'Mithi', 'Panjgur', 'Kharan', 'Awaran', 'Dalbandin', 'Zhob', 'Sost', 'Nok Kundi'].map(c => { const city = N(c); const v = addNode({ name: `VSAT terminal · ${c}`, pos: city.pos.clone().add(new THREE.Vector3(0.05, 0.05, 0)), tier: 'vsat', kind: 'vsat', lon: city.lon, lat: city.lat }); addEdge(v, city, 'metro', []); v.city = city; return v; });
const satCurve = (a, b) => { const m = a.clone().lerp(b, 0.5); m.z += 1.2; return new THREE.QuadraticBezierCurve3(a, m, b).getPoints(40); };
[...GW, ...VSAT].forEach(g => addEdge(g, SAT, 'sat', ['PakSat'], satCurve(g.pos, SAT.pos)));
const hubs = nodes.filter(n => n.kind === 'city' && n.tier !== 'access');
for (const n of nodes.filter(n => n.kind === 'city' && n.tier === 'access')) {
  let best = null, bd = 1e9; for (const h of hubs) { const d = h.pos.distanceToSquared(n.pos); if (d < bd) { bd = d; best = h; } }
  n.remote = (n.lon < 67.6 && n.lat > 25.3) || n.lat > 34.9 || Math.sqrt(bd) > 0.7;
  addEdge(n, best, n.remote ? 'mwaccess' : 'access', []); n.parent = best;
}

/* ---------------- draw network ---------------- */
const gCables = layer('cables'), gBackbone = layer('backbone'), gMW = layer('microwave', false), gSat = layer('satellite', false),
  gPlanned = layer('planned', false), gCities = layer('cities'), gLastMile = layer('lastmile', false), gRouters = layer('routers'),
  gGate = layer('gateways'), gPackets = layer('packets'), gHeat = layer('heat', false), gFX = layer('fx'), gLabels = layer('labels');
const lift = (p, dz = 0) => p.clone().setZ(p.z + dz);
{
  const fib = edges.filter(e => e.type === 'fiber');
  const trunk = fib.filter(e => e.ops.length >= 3), minor = fib.filter(e => e.ops.length < 3);
  const seg = (list, dz = 0) => list.map(e => ({ a: lift(e.pts[0], dz), b: lift(e.pts[e.pts.length - 1], dz) }));
  gBackbone.add(fatSegs(seg(trunk), { color: 0xffffff, linewidth: 5.5, opacity: 0.55 }));
  gBackbone.add(fatSegs(seg(minor), { color: 0xffffff, linewidth: 3.5, opacity: 0.45 }));
  gBackbone.add(fatSegs(seg(trunk, 0.002), { color: INK, linewidth: 2.4, opacity: 0.85 }));
  gBackbone.add(fatSegs(seg(minor, 0.002), { color: INK, linewidth: 1.3, opacity: 0.7 }));
  const dashedTypes = edges.filter(e => e.type === 'aerial' || e.type === 'xborder');
  gBackbone.add(fatSegs(dashedTypes.map(e => ({ a: lift(e.pts[0]), b: lift(e.pts[e.pts.length - 1]) })), { color: INK, linewidth: 1.4, opacity: 0.7, dashed: true, dashSize: 0.06, gapSize: 0.05 }));
  const mw = edges.filter(e => e.type === 'microwave');
  gBackbone.add(fatSegs(mw.map(e => ({ a: e.pts[0], b: e.pts[1] })), { color: INK, linewidth: 1.1, opacity: 0.55, dashed: true, dashSize: 0.025, gapSize: 0.035 }));
  const mwb = edges.filter(e => e.type === 'mwbackup');
  gMW.add(fatSegs(mwb.map(e => ({ a: e.pts[0], b: e.pts[1] })), { color: 0x7c3aed, linewidth: 1.4, opacity: 0.85, dashed: true, dashSize: 0.03, gapSize: 0.03 }));
  // last mile
  const acc = []; for (const e of edges.filter(e => e.type === 'access' || e.type === 'mwaccess')) acc.push(e.pts[0].x, e.pts[0].y, TOP + 0.006, e.pts[1].x, e.pts[1].y, TOP + 0.006);
  const ga = new THREE.BufferGeometry(); ga.setAttribute('position', new THREE.Float32BufferAttribute(acc, 3));
  gLastMile.add(new THREE.LineSegments(ga, new THREE.LineBasicMaterial({ color: 0x22312b, transparent: true, opacity: 0.25 })));
}
for (const e of cableEdges) {
  const c = e.cable; const live = c.status === 'live';
  e.line = fatLine(e.pts, { color: c.status === 'retired' ? 0x9aa6a0 : 0x2f4858, linewidth: live ? 1.6 : 1.1, opacity: live ? 0.75 : 0.5, dashed: !live, dashSize: 0.1, gapSize: 0.08 });
  gCables.add(e.line);
}
for (const e of plannedEdges) gPlanned.add(fatLine(e.pts, { color: 0xc2410c, linewidth: 1.8, opacity: 0.85, dashed: true, dashSize: 0.08, gapSize: 0.06 }));
for (const e of edges.filter(e => e.type === 'sat')) gSat.add(fatLine(e.pts, { color: 0x7c3aed, linewidth: 1, opacity: 0.45, dashed: true, dashSize: 0.08, gapSize: 0.08 }));
{ // satellite model
  const s = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.26), new THREE.MeshLambertMaterial({ color: 0xf4f4f0 }));
  const pm = new THREE.MeshLambertMaterial({ color: 0x3a5a8c, side: THREE.DoubleSide });
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.24, 0.01), pm); p1.position.x = 0.55; const p2 = p1.clone(); p2.position.x = -0.55;
  s.add(body, p1, p2); s.position.copy(SAT.pos); s.traverse(o => o.castShadow = true); gSat.add(s); SAT.mesh = s;
}
// router glyphs
const pickables = [];
const M = (c) => new THREE.MeshLambertMaterial({ color: c });
const mInk = M(INK), mWhite = M(0xffffff);
for (const n of nodes) {
  let m = null;
  if (n.tier === 'core') {
    m = new THREE.Group();
    const o = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 32), mInk); o.rotation.x = Math.PI / 2; o.position.z = 0.025;
    const i = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.056, 32), mWhite); i.rotation.x = Math.PI / 2; i.position.z = 0.028;
    m.add(o, i);
    const q = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.12, 64), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uFill: { value: 0.2 }, uCol: { value: new THREE.Color('#16a34a') } },
      vertexShader: `varying vec2 vU; void main(){ vU=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float uFill; uniform vec3 uCol; varying vec2 vU; void main(){ float a=atan(vU.x,vU.y)/6.2831853+.5; gl_FragColor = a>uFill ? vec4(1.,1.,1.,.55) : vec4(uCol,1.); }` }));
    q.position.z = 0.004; q.visible = false; m.add(q); n.queue = q;
  } else if (n.tier === 'agg') {
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 20), mInk); m.rotation.x = Math.PI / 2; m.position.z = 0.015;
    const g = new THREE.Group(); g.add(m); m = g;
  } else if (n.tier === 'cls') {
    m = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), M(n.planned ? 0xd97706 : 0xc2410c)); b.position.z = 0.03; b.castShadow = true; m.add(b);
  } else if (n.tier === 'ixp') {
    m = new THREE.Group(); const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), M(0xca8a04)); d.position.z = 0.05; d.castShadow = true; m.add(d); m.userData.spin = d;
  } else if (n.tier === 'dc') {
    m = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.07), M(0x6d28d9)); b.position.z = 0.035; b.castShadow = true; m.add(b);
  } else if (n.tier === 'gw' || n.tier === 'vsat') {
    m = new THREE.Group(); const d = new THREE.Mesh(new THREE.SphereGeometry(n.tier === 'gw' ? 0.04 : 0.028, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0x7c3aed)); d.rotation.x = -0.9; d.position.z = 0.02; m.add(d);
    m.position.copy(n.pos); gSat.add(m); n.mesh = m; m.traverse(o => o.userData.node = n); pickables.push(m); continue;
  } else if (n.tier === 'tower') {
    m = new THREE.Group(); const t = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.09, 4), M(0x7c3aed)); t.rotation.x = Math.PI / 2; t.position.z = 0.045; m.add(t);
    m.position.copy(n.pos); gMW.add(m); n.mesh = m; m.traverse(o => o.userData.node = n); pickables.push(m); continue;
  } else if (n.tier === 'intl') {
    m = new THREE.Group(); const r = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.1, 40), new THREE.MeshBasicMaterial({ color: 0x2f4858 })); m.add(r);
  }
  if (!m) continue;
  m.position.copy(n.pos); n.mesh = m; m.traverse(o => o.userData.node = n);
  (n.tier === 'core' || n.tier === 'agg' || n.tier === 'intl' ? gRouters : n.planned ? gPlanned : gGate).add(m); pickables.push(m);
}
// all cities as small dots
const accessNodes = nodes.filter(n => n.kind === 'city' && n.tier === 'access');
const accMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.016, 12), new THREE.MeshBasicMaterial({ color: 0x22312b, transparent: true, opacity: 0.5 }), accessNodes.length);
function setAccScale(f) { const m4 = new THREE.Matrix4(); accessNodes.forEach((n, i) => { const s = f * (0.8 + Math.min(1.2, Math.pow(n.pop / 80000, 0.35))); m4.makeScale(s, s, 1).setPosition(n.pos.x, n.pos.y, TOP + 0.005); accMesh.setMatrixAt(i, m4); }); accMesh.instanceMatrix.needsUpdate = true; }
setAccScale(1); gCities.add(accMesh); pickables.push(accMesh);

/* ---------------- labels ---------------- */
const labelObjs = [], boundLabels = [];
function label(html, pos, cls, maxD = 999, minD = 0, off = null) {
  const d = document.createElement('div'); d.className = 'lbl ' + cls;
  d.innerHTML = off ? `<span style="position:relative;left:${off[0]}px;top:${off[1]}px">${html}</span>` : html;
  const o = new CSS2DObject(d); o.position.copy(pos); o.userData = { minD, maxD }; gLabels.add(o); labelObjs.push(o); return o;
}
const OFF = { Rawalpindi: [30, 12], Islamabad: [4, -10], Faisalabad: [-28, 0], Lahore: [20, -2], Peshawar: [-20, 0], "TWA landing station · Hawke's Bay": [-95, -16], "PTCL landing station · Hawke's Bay": [-105, 10], 'Cybernet landing station (PEACE)': [-40, 32], 'PTCL landing station · Sea View': [95, 14], 'Gwadar landing station (planned)': [-20, 18] };
for (const n of nodes) {
  const p = n.pos.clone();
  if (n.tier === 'core') label(n.name, p.setZ(NET + 0.16), 'core', 999, 0, OFF[n.name]);
  else if (n.tier === 'agg') label(n.name, p.setZ(NET + 0.1), 'agg', 11);
  else if (n.tier === 'cls') { const l = label(n.name, p.setZ(NET + 0.1), 'small cls', n.planned ? 999 : 3.4, 0, OFF[n.name]); if (n.planned) { l.element.classList.add('planned'); boundLabels.push([l, gPlanned]); } }
  else if (n.tier === 'ixp' || n.tier === 'dc') label(n.name, p.setZ(NET + 0.1), 'small', 3.4);
  else if (n.tier === 'intl' && !n.hideLabel) label(n.name + ' →', p.setZ(0.25), 'intl');
  else if (n.tier === 'access' && n.pop > 150000 && !CORE.some(c => N(c).pos.distanceTo(n.pos) < 0.3)) label(n.name, p.setZ(NET + 0.06), 'acc', 6);
}
{ const sl = label('PakSat-MM1', SAT.pos.clone().setZ(SAT.pos.z + 0.35), 'core sat'); boundLabels.push([sl, gSat]); }
for (const [t, lo, la] of [['SINDH', 68.7, 26.3], ['PUNJAB', 71.8, 29.3], ['BALOCHISTAN', 65.4, 28.0], ['KHYBER<br>PAKHTUNKHWA', 70.9, 32.75], ['GILGIT-BALTISTAN', 74.9, 35.95], ['AJK', 73.95, 34.55]]) label(t, P(lo, la, TOP + 0.01), 'prov', 999, 7);
for (const [t, lo, la] of [['AFGHANISTAN', 66.3, 33.4], ['IRAN', 59.4, 28.3], ['INDIA', 75.6, 26.6], ['CHINA', 79.0, 37.0], ['ARABIAN SEA', 64.4, 21.6]]) label(t, P(lo, la, 0.02), 'country', 999, 6);
CABLES.forEach(c => { if (c.status === 'retired') return; const e = c.edges[0]; const p = e.pts[Math.floor(e.pts.length * (0.5 + (CABLES.indexOf(c) % 3) * 0.08))]; c.label = label(c.name, p.clone().setZ(0.06), 'cab', 9); });

/* ---------------- routing engine ---------------- */
const TYPEW = { fiber: 1, metro: 0.3, subsea: 1, access: 1.1, mwaccess: 1.3, microwave: 1.7, mwbackup: 1.9, aerial: 1.2, xborder: 1.2, sat: 60, planned: 1.15 };
let plannedActive = false;
function usable(e, ignoreCut) {
  if (e.type === 'planned' && !plannedActive) return false;
  if (e.cable && e.cable.status !== 'live' && !e.cable.forceLive) return false;
  if (e.cut && !ignoreCut?.has(e.id)) return false; return true;
}
class Heap { constructor() { this.a = []; } push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break;[a[p], a[i]] = [a[i], a[p]]; i = p; } } pop() { const a = this.a; const t = a[0], l = a.pop(); if (a.length) { a[0] = l; let i = 0; for (;;) { let s = i; const L = 2 * i + 1, r = L + 1; if (L < a.length && a[L][0] < a[s][0]) s = L; if (r < a.length && a[r][0] < a[s][0]) s = r; if (s === i) break;[a[s], a[i]] = [a[i], a[s]]; i = s; } } return t; } get size() { return this.a.length; } }
function dijkstra(src, dst, opt = {}) {
  const dist = new Map([[src, 0]]), prev = new Map(), order = [], h = new Heap(), done = new Set(); h.push([0, src]);
  const metric = opt.metric || 'latency';
  while (h.size) {
    const [d, u] = h.pop(); if (done.has(u)) continue; done.add(u); order.push(u); if (u === dst) break;
    for (const e of adj.get(u)) {
      if (!usable(e, opt.ignoreCut)) continue; const v = e.a === u ? e.b : e.a; if (done.has(v)) continue;
      if (nodes[v].tier === 'intl' && v !== dst) continue;
      const w = metric === 'hops' ? 1 : metric === 'cost' ? (e.type === 'subsea' ? 3 : e.type === 'sat' ? 40 : 1) * (1 + e.len) : e.len * (TYPEW[e.type] || 1) + 0.02;
      const nd = d + w; if (nd < (dist.get(v) ?? 1e18)) { dist.set(v, nd); prev.set(v, e); h.push([nd, v]); }
    }
  }
  if (!dist.has(dst)) return null;
  const pe = []; let cur = dst; while (cur !== src) { const e = prev.get(cur); pe.push(e); cur = e.a === cur ? e.b : e.a; }
  pe.reverse(); return { edges: pe, cost: dist.get(dst), order };
}
const nodeSeq = (src, pe) => { const s = [src]; let cur = src; for (const e of pe) { cur = e.a === cur ? e.b : e.a; s.push(cur); } return s; };
function buildPath(src, pe) {
  const pts = []; let cur = src;
  for (const e of pe) { const fw = e.a === cur; const ep = fw ? e.pts : [...e.pts].reverse(); for (let i = pts.length ? 1 : 0; i < ep.length; i++) pts.push(ep[i]); cur = fw ? e.b : e.a; }
  const arr = new Float32Array(pts.length * 3), cum = new Float32Array(pts.length); let L = 0;
  pts.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z + 0.03; if (i) L += p.distanceTo(pts[i - 1]); cum[i] = L; });
  const edgeStarts = []; let acc = 0; for (const e of pe) { edgeStarts.push([acc, e]); acc += e.len; }
  return { arr, cum, total: L, edges: pe, edgeStarts, n: pts.length };
}
let epoch = 0; const cache = new Map(); let staleSet = new Set(), convergeUntil = 0, convergeStart = 0;
function route(src, dst, stale = false) {
  const k = src + '|' + dst + '|' + (stale ? 's' : epoch); if (cache.has(k)) return cache.get(k);
  const r = dijkstra(src, dst, stale ? { ignoreCut: staleSet } : {}); const p = r ? buildPath(src, r.edges) : null;
  if (cache.size > 6000) cache.clear(); cache.set(k, p); return p;
}
function concatPaths(a, b) { if (!a) return b; if (!b) return a; const arr = new Float32Array((a.n + b.n - 1) * 3); arr.set(a.arr); arr.set(b.arr.subarray(3), a.n * 3); const cum = new Float32Array(a.n + b.n - 1); cum.set(a.cum); for (let i = 1; i < b.n; i++) cum[a.n - 1 + i] = a.total + b.cum[i]; return { arr, cum, total: a.total + b.total, edges: [...a.edges, ...b.edges], edgeStarts: [...a.edgeStarts, ...b.edgeStarts.map(([d, e]) => [d + a.total, e])], n: a.n + b.n - 1 }; }
function reversePath(p) { const n = p.n, arr = new Float32Array(n * 3), cum = new Float32Array(n); for (let i = 0; i < n; i++) { arr.set(p.arr.subarray((n - 1 - i) * 3, (n - i) * 3), i * 3); cum[i] = p.total - p.cum[n - 1 - i]; } const es = []; let acc = 0; for (const e of [...p.edges].reverse()) { es.push([acc, e]); acc += e.len; } return { arr, cum, total: p.total, edges: [...p.edges].reverse(), edgeStarts: es, n }; }

/* ---------------- packets ---------------- */
const MAXP = 1600, TRAIL = 4;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(MAXP * TRAIL * 3), pCol = new Float32Array(MAXP * TRAIL * 3), pSize = new Float32Array(MAXP * TRAIL), pAlpha = new Float32Array(MAXP * TRAIL);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3));
pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1)); pGeo.setAttribute('aAlpha', new THREE.BufferAttribute(pAlpha, 1));
const pMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uPR: { value: renderer.getPixelRatio() } },
  vertexShader: `attribute float aSize; attribute vec3 aColor; attribute float aAlpha; uniform float uPR; varying vec3 vC; varying float vA;
  void main(){ vC=aColor; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=clamp(aSize*uPR*(1800./-mv.z),3.,13.); gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vC; varying float vA; void main(){ float r=length(gl_PointCoord-.5)*2.; if(r>1.) discard; float edge=smoothstep(1.,.78,r); vec3 c=mix(vec3(1.),vC,smoothstep(.0,.55,r)*.9+.1); c=mix(c, vec3(1.), smoothstep(.72,.9,r)*.0); gl_FragColor=vec4(c,edge*vA); }` });
const pPoints = new THREE.Points(pGeo, pMat); pPoints.frustumCulled = false; pPoints.renderOrder = 10; gPackets.add(pPoints);
const packets = [];
function samplePath(p, d, out) {
  if (d <= 0) { out[0] = p.arr[0]; out[1] = p.arr[1]; out[2] = p.arr[2]; return; }
  if (d >= p.total) { const i = (p.n - 1) * 3; out[0] = p.arr[i]; out[1] = p.arr[i + 1]; out[2] = p.arr[i + 2]; return; }
  let lo = 0, hi = p.n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p.cum[m] < d) lo = m; else hi = m; }
  const t = (d - p.cum[lo]) / Math.max(1e-6, p.cum[hi] - p.cum[lo]), a = lo * 3, b = hi * 3;
  out[0] = p.arr[a] + (p.arr[b] - p.arr[a]) * t; out[1] = p.arr[a + 1] + (p.arr[b + 1] - p.arr[a + 1]) * t; out[2] = p.arr[a + 2] + (p.arr[b + 2] - p.arr[a + 2]) * t;
}
const stats = { cat: {}, cableLoad: {} };
let winSp = 0, winDr = 0;
function emit(path, cat, opt = {}) {
  if (!path || packets.length >= MAXP) return null;
  let dropAt = null; for (const [d, e] of path.edgeStarts) if (e.cut) { dropAt = d + e.len * 0.5; break; }
  const pk = { path, d: 0, v: (opt.speed || 2.2) * (0.85 + Math.random() * 0.3), col: new THREE.Color().setStyle(opt.color || FLOW[cat].c, THREE.LinearSRGBColorSpace), cat, size: opt.size || (cat === 'atk' ? 0.12 : 0.085), dropAt, sink: opt.sink };
  packets.push(pk); winSp++; stats.cat[cat] = (stats.cat[cat] || 0) + 1;
  for (const [, e] of path.edgeStarts) { e.load += 1; if (e.cable) stats.cableLoad[e.cable.id] = (stats.cableLoad[e.cable.id] || 0) + 1; }
  return pk;
}
const srcPool = nodes.filter(n => n.kind === 'city' && n.name !== 'Khunjerab Pass');
const srcW = srcPool.map(n => Math.pow(Math.max(n.pop, 15000), 0.78)); const srcTot = srcW.reduce((a, b) => a + b, 0);
function pickCity() { let r = Math.random() * srcTot; for (let i = 0; i < srcPool.length; i++) { r -= srcW[i]; if (r <= 0) return srcPool[i]; } return srcPool[0]; }
const liveCables = () => CABLES.filter(c => (c.status === 'live' || c.forceLive) && c.edges.some(e => !e.cut));
function pickCableEdge() {
  const live = []; for (const c of liveCables()) for (const e of c.edges) if (!e.cut) live.push([e, c.share * (e.dir === 'W' ? 1.6 : e.dir === 'E' ? 0.9 : 0.8)]);
  if (plannedActive) live.push([plannedEdges[0], 0.12]);
  if (!live.length) return null; const tot = live.reduce((a, b) => a + b[1], 0); let r = Math.random() * tot; for (const [e, w] of live) { r -= w; if (r <= 0) return e; } return live[0][0];
}
function spawnNormal() {
  const r = Math.random(), now = performance.now();
  const stale = now < convergeUntil && Math.random() < 0.55 * (convergeUntil - now) / (convergeUntil - convergeStart);
  if (r < 0.62) {
    const src = pickCity(); let ce = pickCableEdge();
    if (stale && staleSet.size) { const c = edges[[...staleSet][Math.floor(Math.random() * staleSet.size)]]; if (c.cable) ce = c; }
    if (!ce) { const p = route(src.id, INTL.N.id); if (p) emit(Math.random() < 0.5 ? p : reversePath(p), 'intl'); return; }
    const p1 = route(src.id, ce.a, stale); if (!p1) return;
    const full = concatPaths(p1, buildPath(ce.a, [ce])); emit(Math.random() < 0.62 ? reversePath(full) : full, 'intl');
  } else if (r < 0.76) {
    const a = pickCity(), b = pickCity(); if (a !== b) emit(route(a.id, b.id, stale), 'dom');
  } else if (r < 0.88) {
    const a = pickCity(); let best = DCS[0], bd = 1e9; for (const d of DCS) { const dd = d.pos.distanceTo(a.pos); if (dd < bd) { bd = dd; best = d; } }
    const p = route(a.id, best.id); if (p) emit(reversePath(p), 'cdn');
  } else if (r < 0.93) {
    if (!layers.satellite.visible) return;
    const v = VSAT[Math.floor(Math.random() * VSAT.length)], g = GW[Math.floor(Math.random() * GW.length)];
    const p = buildPath(v.id, [adj.get(v.id).find(e => e.type === 'sat'), adj.get(g.id).find(e => e.type === 'sat')]); emit(Math.random() < 0.5 ? p : reversePath(p), 'sat', { speed: 4 });
  } else if (r < 0.97) {
    const src = [N('Islamabad'), N('Rawalpindi'), N('Lahore'), N('Gilgit'), N('Peshawar')][Math.floor(Math.random() * 5)];
    const p = route(src.id, INTL.N.id); if (p) emit(Math.random() < 0.5 ? p : reversePath(p), 'intl');
  } else {
    const [a, b] = [[N('Peshawar'), INTL.AF], [N('Quetta'), INTL.AFS], [N('Quetta'), INTL.IR]][Math.floor(Math.random() * 3)];
    const p = route(a.id, b.id); if (p) emit(Math.random() < 0.5 ? p : reversePath(p), 'intl');
  }
}

/* ---------------- fx ---------------- */
const bursts = []; const burstGeo = new THREE.RingGeometry(0.75, 1, 40);
function burst(pos, color = '#dc2626', s = 0.2, life = 0.8) {
  const m = new THREE.Mesh(burstGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.position.copy(pos); gFX.add(m); bursts.push({ m, t: 0, life, s }); if (bursts.length > 100) { const b = bursts.shift(); gFX.remove(b.m); b.m.material.dispose(); }
}
let hiLines = [];
function clearHighlight() { hiLines.forEach(l => gFX.remove(l)); hiLines = []; }
function highlightPath(src, pe) {
  clearHighlight(); const p = buildPath(src, pe); const pts = []; for (let i = 0; i < p.n; i++) pts.push(new THREE.Vector3(p.arr[i * 3], p.arr[i * 3 + 1], p.arr[i * 3 + 2] - 0.005));
  const a = fatLine(pts, { color: 0xffffff, linewidth: 8, opacity: 0.9 }); const b = fatLine(pts, { color: 0xd97706, linewidth: 4, opacity: 1, dashed: true, dashSize: 0.12, gapSize: 0.05 });
  b.userData.anim = true; gFX.add(a, b); hiLines.push(a, b); return p;
}
const cutMarks = new Map();
function markCut(e) {
  const mid = e.pts[Math.floor(e.pts.length * (e.cable ? 0.3 : 0.5))]; const g = new THREE.Group();
  g.add(fatLine(e.pts.map(p => lift(p, 0.004)), { color: 0xdc2626, linewidth: 2.6, opacity: 1, dashed: true, dashSize: 0.05, gapSize: 0.04 }));
  const xm = M(0xdc2626); const x = new THREE.Group(); const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.03), xm); b1.rotation.z = 0.78; const b2 = b1.clone(); b2.rotation.z = -0.78;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.16, 32), mWhite); disc.position.z = -0.01; x.add(disc, b1, b2); x.position.copy(mid).setZ(mid.z + 0.05); g.add(x);
  gFX.add(g); cutMarks.set(e.id, g); e.cutPos = mid;
}
function unmarkCut(e) { const g = cutMarks.get(e.id); if (g) { gFX.remove(g); cutMarks.delete(e.id); } }
function shieldAt(node, r = 0.42) {
  const g = new THREE.Group();
  const d = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x16a34a, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
  d.rotation.x = Math.PI / 2; const ring = fatLine(Array.from({ length: 65 }, (_, i) => new THREE.Vector3(Math.cos(i / 64 * 6.283) * r, Math.sin(i / 64 * 6.283) * r, 0.005)), { color: 0x16a34a, linewidth: 2, opacity: 0.9 });
  g.add(d, ring); g.position.copy(node.pos).setZ(TOP); gFX.add(g); return g;
}

/* ---------------- state & actions ---------------- */
const ui = id => document.getElementById(id);
let simHour = 21, speed = 1, playing = true, spawnAcc = 0, lastConv = 0;
const series = { thr: [], lat: [], loss: [], conv: [] };
const fmtClock = h => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
function diurnal(h) { h = ((h % 24) + 24) % 24; if (h >= 5 && h <= 22) return 0.3 + 0.7 * (1 - Math.cos(Math.PI * (h - 5) / 17)) / 2; const t = ((h - 22 + 24) % 24) / 7; return 0.3 + 0.7 * (1 + Math.cos(Math.PI * t)) / 2; }
let noteTimer = null;
function note(msg, kind = '') { const t = ui('note'); t.className = 'on ' + kind; t.innerHTML = msg; clearTimeout(noteTimer); noteTimer = setTimeout(() => t.className = '', 4200); }
function topologyChanged(cutEdges, algo = 'OSPF') {
  epoch++; cache.clear(); if (hiLines.length && cutEdges && cutEdges.length) { clearHighlight(); }
  for (const pk of packets) if (pk.dropAt === null) for (const [d, e] of pk.path.edgeStarts) if (e.cut && d + e.len * 0.5 > pk.d) { pk.dropAt = d + e.len * 0.5; break; }
  if (cutEdges && cutEdges.length) {
    staleSet = new Set(cutEdges.map(e => e.id)); convergeStart = performance.now();
    const T = algo === 'BGP' ? 6500 : algo === 'RIP' ? 9000 : 2600; convergeUntil = convergeStart + T;
    lastConv = algo === 'BGP' ? 30 + Math.random() * 25 : algo === 'RIP' ? 90 + Math.random() * 60 : 0.6 + Math.random() * 1.6;
    showConv(algo, lastConv, T);
  }
  renderCables(); updateKPIs();
}
function cutEdge(e) { if (e.cut) return; e.cut = true; markCut(e); burst(lift(e.cutPos, 0.06), '#dc2626', 0.5, 1); }
function restoreEdge(e) { if (!e.cut) return; e.cut = false; unmarkCut(e); }
function cutCable(c, on, algo = 'BGP') {
  if (on) { c.edges.forEach(cutEdge); note(`<b>${c.name}</b> cut — traffic moves to the remaining cables`, 'bad'); topologyChanged(c.edges, algo); }
  else { c.edges.forEach(restoreEdge); note(`<b>${c.name}</b> restored`, 'good'); topologyChanged([], algo); }
}
function restoreAll() { edges.forEach(restoreEdge); staleSet = new Set(); convergeUntil = 0; note('Everything restored', 'good'); topologyChanged([]); }
let convTimer = null;
function showConv(algo, shown, T) {
  const el = ui('conv'); el.classList.add('on'); const s = performance.now();
  clearInterval(convTimer);
  convTimer = setInterval(() => {
    const f = Math.min(1, (performance.now() - s) / T);
    el.innerHTML = `<span>${f < 1 ? 'Rerouting' : 'Converged'} · ${algo}</span><b>${(shown * f).toFixed(shown < 5 ? 2 : 1)} s</b><i style="width:${f * 100}%"></i>`;
    if (f >= 1) { clearInterval(convTimer); setTimeout(() => el.classList.remove('on'), 2200); }
  }, 50);
}

/* ---------------- security scenarios (scripted mock) ---------------- */
let defense = true; const scen = { hijack: null, ddos: null, mal: null }; const timers = [];
const later = (ms, fn) => timers.push(setTimeout(fn, ms));
function alertFeed(html, kind) { const box = ui('alerts'); if (box.querySelector('.empty')) box.innerHTML = ''; const el = document.createElement('div'); el.className = 'alert ' + kind; el.innerHTML = html; box.prepend(el); while (box.children.length > 8) box.lastChild.remove(); }
function stopScenarios() { timers.forEach(clearTimeout); timers.length = 0; scen.hijack = scen.ddos = scen.mal = null; shields.forEach(s => gFX.remove(s)); shields.length = 0; }
const shields = [];
function runHijack() {
  stopScenarios(); setTab('security'); ui('alerts').innerHTML = ''; const k = N('Karachi'); scen.hijack = { phase: 1 };
  alertFeed('AS17557 (PTCL) announces <code>208.65.153.0/24</code> to block YouTube inside Pakistan', 'info'); burst(lift(k.pos, 0.05), '#dc2626', 0.7, 1.4);
  later(1800, () => { alertFeed('The route leaks to upstream AS3491 (PCCW) and spreads worldwide — the /24 is more specific than YouTube\'s /22', 'crit'); scen.hijack.phase = 2; });
  later(3500, () => { scen.hijack.phase = 3; alertFeed('YouTube traffic from abroad now flows into Pakistan and is dropped', 'crit'); });
  if (defense) {
    later(5600, () => alertFeed('<b>Detected:</b> origin conflict, RPKI says invalid (only AS36561 is authorised)', 'warn'));
    later(7600, () => { alertFeed('<b>Adapted:</b> upstreams filter the bad route, YouTube announces more-specific /25s — contained', 'ok'); scen.hijack.phase = 4; shields.push(shieldAt(k, 0.6)); });
    later(12500, () => scen.hijack = null);
  } else { later(7000, () => alertFeed('No defence — in 2008 the outage lasted about two hours', 'crit')); later(14000, () => scen.hijack = null); }
}
function runDDoS() {
  stopScenarios(); setTab('security'); ui('alerts').innerHTML = ''; const dc = DCS[1]; scen.ddos = { phase: 1, target: dc, scrub: DCS[3] };
  alertFeed('Volumetric DDoS against the Lahore CDN edge (illustrative)', 'info');
  later(1500, () => alertFeed('Lahore queues full · loss 12% · latency +140 ms', 'crit'));
  if (defense) {
    later(4000, () => alertFeed('<b>Detected:</b> traffic 40× normal from three cable entry points', 'warn'));
    later(6000, () => { scen.ddos.phase = 2; alertFeed('<b>Adapted:</b> attack traffic diverted to scrubbing in Karachi, clean traffic forwarded', 'ok'); shields.push(shieldAt(dc.city, 0.5)); });
    later(14000, () => scen.ddos = null);
  } else later(12000, () => scen.ddos = null);
}
function runMalware() {
  stopScenarios(); setTab('security'); ui('alerts').innerHTML = ''; const city = N('Mardan'); scen.mal = { phase: 1, city };
  alertFeed('Compromised phones near Mardan start calling an external command server', 'info');
  if (defense) {
    later(3000, () => alertFeed('<b>Detected:</b> periodic beaconing to an unusual network · risk 0.91', 'warn'));
    later(5000, () => { scen.mal.phase = 2; alertFeed('<b>Adapted:</b> devices quarantined, step-up authentication, server blocked at the edge', 'ok'); shields.push(shieldAt(city, 0.35)); });
    later(12000, () => scen.mal = null);
  } else later(11000, () => scen.mal = null);
}
function spawnScenario(dt) {
  if (scen.hijack) {
    const ph = scen.hijack.phase, k = N('Karachi');
    if (ph === 2 && Math.random() < dt * 30) { const ce = pickCableEdge(); if (ce) emit(buildPath(ce.a, [ce]), 'atk', { speed: 3 }); }
    if (ph === 3 && Math.random() < dt * 60) { const ce = pickCableEdge(); if (ce) emit(reversePath(concatPaths(route(k.id, ce.a), buildPath(ce.a, [ce]))), 'atk', { speed: 2.6, sink: true }); }
  }
  if (scen.ddos) {
    const tgt = scen.ddos.phase === 2 ? scen.ddos.scrub : scen.ddos.target;
    if (Math.random() < dt * 80) { const ce = pickCableEdge(); if (ce) emit(reversePath(concatPaths(route(tgt.id, ce.a), buildPath(ce.a, [ce]))), 'atk', { speed: 2.6, sink: true }); }
    if (Math.random() < dt * 15) { const a = pickCity(); const p = route(a.id, tgt.id); if (p) emit(p, 'atk', { sink: true }); }
  }
  if (scen.mal) {
    const c = scen.mal.city;
    if (scen.mal.phase === 1 && Math.random() < dt * 25) { const ce = pickCableEdge(); if (ce) emit(concatPaths(route(c.id, ce.a), buildPath(ce.a, [ce])), 'atk', { color: '#be185d' }); }
    if (scen.mal.phase === 2 && Math.random() < dt * 10) { const p = route(c.id, N('Peshawar').id); if (p) { const pk = emit(p, 'atk', { color: '#be185d' }); if (pk) pk.dropAt = 0.1; } }
  }
}

/* ---------------- routing demos ---------------- */
const routeNodes = nodes.filter(n => (n.kind === 'city' && n.tier !== 'access' && !/Pass/.test(n.name)) || (n.tier === 'intl' && !n.hideLabel) || (n.tier === 'cls' && !n.planned) || n.tier === 'dc' || n.tier === 'ixp')
  .sort((a, b) => (a.tier === 'intl') - (b.tier === 'intl') || a.name.localeCompare(b.name));
let algo = 'dijkstra', metric = 'latency';
const tierName = n => ({ core: 'Core router', agg: 'Aggregation router', access: 'City (access network)', cls: 'Cable landing station', ixp: 'Internet exchange', dc: 'Data centre / CDN', intl: 'International destination', sat: 'Satellite', gw: 'Satellite gateway', vsat: 'VSAT terminal', tower: 'Microwave relay' }[n.tier] || n.tier);
const mediumName = e => ({ fiber: 'fibre', metro: 'metro fibre', subsea: 'submarine cable', access: 'last mile', mwaccess: 'microwave', microwave: 'microwave', mwbackup: 'microwave', aerial: 'aerial fibre', xborder: 'cross-border fibre', sat: 'satellite', planned: 'planned fibre' }[e.type] || e.type);
function traceRoute() {
  const s = +ui('rsrc').value, d = +ui('rdst').value; if (s === d) return;
  const res = dijkstra(s, d, { metric }); if (!res) { ui('rres').innerHTML = '<p class="muted">No path — destination unreachable.</p>'; return; }
  const p = highlightPath(s, res.edges);
  for (let i = 0; i < 5; i++) setTimeout(() => emit(p, 'loop', { color: '#b45309', size: 0.12, speed: 1.8 }), i * 260);
  if (algo === 'dijkstra') res.order.filter(id => nodes[id].tier !== 'access').slice(0, 90).forEach((id, i) => setTimeout(() => burst(lift(nodes[id].pos, 0.02), '#d97706', 0.1, 0.6), i * 22));
  else if (algo === 'bf') {
    const seen = new Set([d]); let fr = [d];
    for (let k = 1; k < 9 && fr.length; k++) { const nf = []; for (const u of fr) for (const e of adj.get(u)) { if (!usable(e)) continue; const v = e.a === u ? e.b : e.a; if (!seen.has(v) && nodes[v].tier !== 'access') { seen.add(v); nf.push(v); } } fr = nf; nf.forEach(v => setTimeout(() => burst(lift(nodes[v].pos, 0.02), '#d97706', 0.12, 0.7), k * 380)); }
  }
  const seq = nodeSeq(s, res.edges); let ms = 0; const rows = [];
  seq.forEach((id, i) => { const e = res.edges[i - 1]; if (e) ms += e.len * KM_PER_UNIT * 1.35 * 0.005 + 0.06; const n = nodes[id]; if (n.tier === 'tower') return; rows.push(`<li><span>${n.name}</span><em>${e ? mediumName(e) : 'start'}${algo === 'bgp' && e ? ' · ' + (e.cable ? e.cable.op : e.ops[0] || '—') : ''}</em><b>${(ms * 2).toFixed(1)}</b></li>`); });
  let asPath = '';
  if (algo === 'bgp') { const ap = []; res.edges.forEach(e => { const a = e.cable ? e.cable.op : e.ops[0]; if (a && ap[ap.length - 1] !== a) ap.push(a); }); asPath = `<div class="aspath">${ap.map(a => `<span>${a === 'PTCL' ? 'AS17557 PTCL' : a}</span>`).join('<i>›</i>')}</div>`; }
  ui('rres').innerHTML = `<div class="rsum"><div><b>${seq.length - 1}</b><small>hops</small></div><div><b>${(ms * 2).toFixed(1)}</b><small>ms round trip</small></div><div><b>${res.order.length}</b><small>nodes explored</small></div></div>${asPath}<details><summary>Hop by hop</summary><ol class="hops">${rows.join('')}</ol></details>`;
}
let loopTimer = null;
function countToInfinity() {
  setTab('route'); const A = N('Sibi'), B = N('Jacobabad'), X = N('Quetta');
  const e = adj.get(A.id).find(e => e.a === X.id || e.b === X.id); if (!e || e.cut) return;
  cutEdge(e); topologyChanged([e], 'RIP'); flyTo('cti');
  const box = ui('cti'); box.innerHTML = ''; let k = 0;
  const p1 = buildPath(A.id, [adj.get(A.id).find(x => x.a === B.id || x.b === B.id)]), p2 = reversePath(p1);
  clearInterval(loopTimer);
  loopTimer = setInterval(() => {
    k++; const da = 1 + 2 * k, db = 2 + 2 * k;
    box.innerHTML = `<div class="ctirow"><span>Round ${k}</span><span>Sibi → Quetta <b>${da >= 16 ? '∞' : da}</b></span><span>Jacobabad → Quetta <b>${db >= 16 ? '∞' : db}</b></span></div>` + box.innerHTML;
    emit(k % 2 ? p1 : p2, 'loop', { speed: 1.5, size: 0.12 }); emit(k % 2 ? p2 : p1, 'loop', { speed: 1.5, size: 0.12 });
    if (da >= 16) { clearInterval(loopTimer); box.innerHTML = `<div class="ctirow done">Hit 16 (= infinity), route withdrawn. Split horizon or poison reverse prevents this.</div>` + box.innerHTML; }
  }, 650);
}

/* ---------------- UI wiring ---------------- */
function setTab(t) { document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + t)); }
document.querySelectorAll('.tab').forEach(b => b.onclick = () => setTab(b.dataset.tab));
const LAYER_UI = [
  ['Network', [['backbone', 'Fibre backbone'], ['cables', 'Submarine cables'], ['gateways', 'Landing stations, IXPs, data centres'], ['microwave', 'Microwave backup (KKH)'], ['satellite', 'Satellite (PakSat-MM1)'], ['planned', 'Planned (Gwadar, CPEC-II)']]],
  ['Places', [['cities', 'All cities'], ['lastmile', 'Last-mile links'], ['labels', 'Labels']]],
  ['Traffic', [['packets', 'Packets'], ['heat', 'Link load']]]
];
ui('layerList').innerHTML = LAYER_UI.map(([g, items]) => `<h5>${g}</h5>` + items.map(([k, t]) => `<label class="chk"><input type="checkbox" data-k="${k}" ${layers[k].visible ? 'checked' : ''}><i></i>${t}</label>`).join('')).join('');
function setLayer(k, v) {
  layers[k].visible = v; const i = document.querySelector(`[data-k="${k}"]`); if (i) i.checked = v;
  if (k === 'labels') labelRenderer.domElement.style.display = v ? '' : 'none';
  if (k === 'heat') { gBackbone.children.forEach(c => c.material.opacity = v ? 0.25 : c.userData.o ?? c.material.opacity); nodes.forEach(n => n.queue && (n.queue.visible = v)); }
}
gBackbone.children.forEach(c => c.userData.o = c.material.opacity);
document.querySelectorAll('#layerList input').forEach(i => i.onchange = () => setLayer(i.dataset.k, i.checked));
document.querySelectorAll('[data-pop]').forEach(b => b.onclick = (ev) => { ev.stopPropagation(); const p = ui(b.dataset.pop); const open = !p.classList.contains('on'); document.querySelectorAll('.pop').forEach(x => x.classList.remove('on')); document.querySelectorAll('[data-pop]').forEach(x => x.classList.remove('on')); if (open) { p.classList.add('on'); b.classList.add('on'); } });
document.addEventListener('click', ev => { if (!ev.target.closest('.pop')) { document.querySelectorAll('.pop').forEach(x => x.classList.remove('on')); document.querySelectorAll('[data-pop]').forEach(x => x.classList.remove('on')); } });
ui('legendList').innerHTML = ['intl', 'dom', 'cdn', 'sat', 'atk'].map(k => `<div class="lg"><i style="background:${FLOW[k].c}"></i>${FLOW[k].label}</div>`).join('') +
  `<hr><div class="lg"><svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="#22312b"/><circle cx="8" cy="8" r="4" fill="#fff"/></svg>Core router</div><div class="lg"><svg width="16" height="16"><circle cx="8" cy="8" r="3" fill="#22312b"/></svg>Aggregation router</div><div class="lg"><svg width="16" height="16"><circle cx="8" cy="8" r="2" fill="#22312b" opacity=".5"/></svg>City</div><div class="lg"><svg width="16" height="16"><rect x="4" y="4" width="8" height="8" fill="#c2410c"/></svg>Cable landing station</div><div class="lg"><svg width="16" height="16"><path d="M8 2l6 6-6 6-6-6z" fill="#ca8a04"/></svg>Internet exchange (PKIX)</div><div class="lg"><svg width="16" height="16"><rect x="5" y="3" width="6" height="10" fill="#6d28d9"/></svg>Data centre / CDN</div><div class="lg"><svg width="16" height="16"><line x1="1" y1="8" x2="15" y2="8" stroke="#22312b" stroke-width="2.5"/></svg>Fibre (trunk / regional)</div><div class="lg"><svg width="16" height="16"><line x1="1" y1="8" x2="15" y2="8" stroke="#2f4858" stroke-width="1.5"/></svg>Submarine cable</div><div class="lg"><svg width="16" height="16"><line x1="1" y1="8" x2="15" y2="8" stroke="#22312b" stroke-width="1.5" stroke-dasharray="3 2"/></svg>Dashed: microwave, cross-border or not yet active</div>`;
const opt = routeNodes.map(n => `<option value="${n.id}">${n.name}</option>`).join('');
ui('rsrc').innerHTML = opt; ui('rdst').innerHTML = opt; ui('rsrc').value = N('Gilgit').id; ui('rdst').value = INTL.W.id;
const ALGO_TXT = { dijkstra: 'Link-state (OSPF): every router knows the whole map and runs Dijkstra. Pulses show nodes settling in order of distance.', bf: 'Distance-vector (RIP): routers only share distances with neighbours, so estimates spread outward in waves.', bgp: 'Path-vector (BGP): networks choose routes by business policy. Hops are grouped by the operator (AS) carrying them.' };
document.querySelectorAll('#algos button').forEach(b => b.onclick = () => { algo = b.dataset.a; document.querySelectorAll('#algos button').forEach(x => x.classList.toggle('on', x === b)); ui('algoTxt').textContent = ALGO_TXT[algo]; ui('ctiWrap').style.display = algo === 'bf' ? '' : 'none'; });
ui('algoTxt').textContent = ALGO_TXT.dijkstra;
ui('rmetric').onchange = e => metric = e.target.value;
ui('btnTrace').onclick = traceRoute; ui('btnCTI').onclick = countToInfinity;
ui('btnSwap').onclick = () => { const a = ui('rsrc').value; ui('rsrc').value = ui('rdst').value; ui('rdst').value = a; };
function renderCables() {
  ui('cablelist').innerHTML = CABLES.filter(c => c.status !== 'retired').map(c => {
    const cut = c.edges.every(e => e.cut), pending = c.status === 'landed' && !c.forceLive;
    const st = pending ? 'Landed, not yet active' : cut ? 'Cut' : c.forceLive ? 'Active (what-if)' : 'Live';
    return `<label class="crow ${cut ? 'cut' : ''} ${pending ? 'pending' : ''}"><div><b>${c.name}</b><small>${c.op} · ${st}</small></div><span class="tog"><input type="checkbox" data-c="${c.id}" ${!cut && !pending ? 'checked' : ''}><i></i></span></label>`;
  }).join('');
  ui('cablelist').querySelectorAll('input').forEach(i => i.onchange = () => {
    const c = CABLES.find(x => x.id === i.dataset.c);
    if (c.status === 'landed') { c.forceLive = i.checked; c.edges.forEach(e => { e.line.material.dashed = !c.forceLive; e.line.material.opacity = c.forceLive ? 0.75 : 0.5; if (i.checked && e.cut) restoreEdge(e); }); note(`${c.name} ${c.forceLive ? 'activated (what-if)' : 'deactivated'}`); topologyChanged([]); }
    else cutCable(c, !i.checked, ui('falgo').value);
  });
}
const SCEN = {
  aae1: () => { cutCable(CABLES.find(c => c.id === 'AAE1'), true, 'BGP'); flyTo('karachi'); },
  oct25: () => { const a = CABLES.find(c => c.id === 'PEACE'), b = CABLES.find(c => c.id === 'IMEWE'); [a, b].forEach(c => c.edges.forEach(cutEdge)); note('PEACE cut and IMEWE down (Oct 2025)', 'bad'); topologyChanged([...a.edges, ...b.edges], 'BGP'); flyTo('karachi'); },
  karachi: () => { CABLES.forEach(c => c.status !== 'retired' && c.edges.forEach(cutEdge)); note('<b>Karachi landing zone lost.</b> Only the China fibre, satellite and land borders remain', 'bad'); topologyChanged(cableEdges, 'BGP'); flyTo('overview'); },
  kkh: () => { const e = adj.get(N('Chilas').id).find(e => e.type === 'fiber' && (nodes[e.a].name === 'Gilgit' || nodes[e.b].name === 'Gilgit')); cutEdge(e); setLayer('microwave', true); note('Landslide cuts the KKH fibre — Gilgit-Baltistan fails over to the microwave chain', 'bad'); topologyChanged([e], 'OSPF'); flyTo('north'); },
  gwadar: () => { plannedActive = !plannedActive; setLayer('planned', plannedActive); note(plannedActive ? 'Gwadar landing and CPEC-II fibre switched on (what-if)' : 'Gwadar what-if off', plannedActive ? 'good' : ''); ui('scGwadar').classList.toggle('on', plannedActive); topologyChanged([]); },
  restore: restoreAll
};
document.querySelectorAll('[data-scen]').forEach(b => b.onclick = () => SCEN[b.dataset.scen]());
ui('def').onchange = e => { defense = e.target.checked; ui('defTxt').textContent = defense ? 'Detects attacks and adapts routing automatically' : 'Off — watch what happens without it'; };
ui('btnHijack').onclick = runHijack; ui('btnDDoS').onclick = runDDoS; ui('btnMal').onclick = runMalware;
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const g = b.dataset.go; if (g === 'route') { setTab('route'); traceRoute(); } if (g === 'cut') { setTab('failures'); SCEN.aae1(); } if (g === 'hijack') runHijack(); });
ui('play').onclick = () => { playing = !playing; ui('play').classList.toggle('paused', !playing); };
document.querySelectorAll('#speeds button').forEach(b => b.onclick = () => { speed = +b.dataset.s; document.querySelectorAll('#speeds button').forEach(x => x.classList.toggle('on', x === b)); });
ui('tod').oninput = e => simHour = +e.target.value;
const VIEWS = {
  overview: { p: [0.4, -19.5, 19], t: [0.4, -2.3, 0] }, top: { p: [0.3, -1.6, 27], t: [0.3, -1.4, 0] },
  karachi: { p: [-1.95, -6.55, 3.1], t: [-1.98, -5.3, 0] }, north: { p: [3.6, 1.4, 4.6], t: [4.3, 4.9, 0] },
  sea: { p: [-1.2, -16.5, 6], t: [-2.3, -7.8, 0] }, sat: { p: [-11, -10, 9], t: [-2.4, 0.4, 1.2] }, cti: { p: [-1.3, -4.4, 3.4], t: [-0.6, -1.9, 0] }
};
let fly = null;
function flyTo(k, dur = 2200) { const v = VIEWS[k]; fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...v.p), t1: new THREE.Vector3(...v.t), s: performance.now(), dur }; document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === k)); }
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { tour = false; ui('btnTour').classList.remove('on'); flyTo(b.dataset.view); });
let tour = false, tourIdx = 0, tourNext = 0; const TOUR = ['overview', 'karachi', 'sea', 'north', 'top'];
ui('btnTour').onclick = () => { tour = !tour; ui('btnTour').classList.toggle('on', tour); tourNext = 0; };
window.__flyTo = flyTo; window.__sim = { SCEN, runHijack, runDDoS, runMalware, setTab, traceRoute, countToInfinity, setLayer };

// hover & inspect
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let hoverNode = null, inspectNode = null, hoverPending = null, downAt = null;
renderer.domElement.addEventListener('pointermove', ev => { mouse.set(ev.clientX / innerWidth * 2 - 1, -ev.clientY / innerHeight * 2 + 1); hoverPending = [ev.clientX, ev.clientY]; });
renderer.domElement.addEventListener('pointerdown', ev => downAt = [ev.clientX, ev.clientY]);
renderer.domElement.addEventListener('pointerup', ev => { if (downAt && Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) < 5) hoverNode ? openInspector(hoverNode) : closeInspector(); });
function pick() {
  ray.setFromCamera(mouse, camera);
  const vis = pickables.filter(o => { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; });
  const hit = ray.intersectObjects(vis, true)[0]; if (!hit) return null; return hit.object === accMesh ? accessNodes[hit.instanceId] : hit.object.userData.node || null;
}
function tip(n, x, y) { const t = ui('tip'); if (!n) { t.style.opacity = 0; return; } t.innerHTML = `<b>${n.name}</b><small>${tierName(n)}${n.pop ? ' · pop. ' + n.pop.toLocaleString() : ''}</small>`; t.style.opacity = 1; t.style.transform = `translate(${x + 14}px, ${y + 12}px)`; }
function openInspector(n) {
  inspectNode = n; const el = ui('insp'); el.classList.add('on');
  const links = adj.get(n.id).filter(e => e.type !== 'access' || n.tier === 'access').slice(0, 7).map(e => { const o = nodes[e.a === n.id ? e.b : e.a]; return `<li class="${e.cut ? 'cut' : ''}"><span>${o.name}</span><em>${mediumName(e)}</em><b data-e="${e.id}"></b></li>`; }).join('');
  el.innerHTML = `<button class="x" id="inspX" aria-label="Close">×</button><small class="kick">${tierName(n)}</small><h3>${n.name}</h3>
  <div class="meters"><div><label>Queue</label><div class="bar"><i id="iq"></i></div></div><div><label>Load</label><b id="ipps">—</b></div></div>
  <label class="sub">Links</label><ul class="links">${links || '<li class="muted">none</li>'}</ul>
  <div class="row"><button class="btn sm" id="iSrc">Route from here</button><button class="btn sm ghost danger" id="iFail">Fail this node</button></div>`;
  ui('inspX').onclick = closeInspector;
  ui('iSrc').onclick = () => { if (routeNodes.includes(n)) ui('rsrc').value = n.id; setTab('route'); };
  ui('iFail').onclick = () => { const es = adj.get(n.id).filter(e => !e.cut); es.forEach(cutEdge); note(`${n.name} failed — ${es.length} links down`, 'bad'); topologyChanged(es, 'OSPF'); openInspector(n); };
}
function closeInspector() { inspectNode = null; ui('insp').classList.remove('on'); }

/* ---------------- metrics ---------------- */
function spark(id, data, color, max) {
  const cv = ui(id); if (!cv || !cv.clientWidth) return; const w = cv.width = cv.clientWidth * 2, h = cv.height = cv.clientHeight * 2, x = cv.getContext('2d'); x.clearRect(0, 0, w, h);
  if (data.length < 2) return; const mx = max || Math.max(...data, 1e-6) * 1.2;
  x.beginPath(); data.forEach((v, i) => { const px = i / 119 * w, py = h - v / mx * (h - 6) - 3; i ? x.lineTo(px, py) : x.moveTo(px, py); });
  x.lineWidth = 3; x.strokeStyle = color; x.lineJoin = 'round'; x.stroke(); x.lineTo((data.length - 1) / 119 * w, h); x.lineTo(0, h); x.globalAlpha = 0.12; x.fillStyle = color; x.fill(); x.globalAlpha = 1;
}
function updateKPIs() {
  const live = liveCables(); const cap = Math.max(0.35, live.reduce((a, c) => a + c.share, 0) * 17.2 / 0.96 + (plannedActive ? 2 : 0));
  ui('kCab').textContent = `${live.length}/${CABLES.filter(c => c.status !== 'retired').length}`; ui('kCap').textContent = cap.toFixed(1); return cap;
}
setInterval(() => {
  const cap = updateKPIs(), load = diurnal(simHour), demand = 12.4 * load + (scen.ddos ? 3 : 0);
  const thr = Math.min(cap * 0.97, demand) * (0.97 + Math.random() * 0.06);
  const congestion = Math.min(4, Math.max(0, demand / Math.max(cap, 0.1) - 0.8));
  const loss = Math.min(100, (winSp ? winDr / winSp * 100 : 0) + congestion * 8);
  const lat = 21 + congestion * 90 + (scen.ddos && scen.ddos.phase === 1 ? 120 : 0) + Math.random() * 2;
  series.thr.push(thr); series.lat.push(lat); series.loss.push(loss); series.conv.push(performance.now() < convergeUntil ? lastConv : 0);
  for (const k in series) if (series[k].length > 120) series[k].shift();
  ui('kThr').textContent = thr.toFixed(1); ui('kLat').textContent = lat.toFixed(0); ui('kLoss').textContent = loss.toFixed(1);
  ui('kLoss').parentElement.classList.toggle('bad', loss > 1);
  ui('mThr').textContent = thr.toFixed(1) + ' Tbps'; ui('mLat').textContent = lat.toFixed(0) + ' ms'; ui('mLoss').textContent = loss.toFixed(2) + ' %'; ui('mConv').textContent = series.conv.at(-1) ? series.conv.at(-1).toFixed(1) + ' s' : 'stable';
  spark('cThr', series.thr, '#0f766e', 18); spark('cLat', series.lat, '#b45309'); spark('cLoss', series.loss, '#dc2626'); spark('cConv', series.conv, '#6d28d9');
  const tot = Object.values(stats.cableLoad).reduce((a, b) => a + b, 0) || 1;
  ui('cutil').innerHTML = CABLES.filter(c => c.status !== 'retired').map(c => { const dead = c.edges.every(e => e.cut) || (c.status === 'landed' && !c.forceLive); const u = dead ? 0 : Math.min(98, (stats.cableLoad[c.id] || 0) / tot * 100 / Math.max(0.03, c.share) * 0.42 * load + 8); return `<div class="cu"><span>${c.name}</span><div class="bar"><i style="width:${u}%;background:${u > 85 ? '#dc2626' : u > 65 ? '#d97706' : '#0f766e'}"></i></div><em>${dead ? '—' : u.toFixed(0) + '%'}</em></div>`; }).join('');
  stats.cableLoad = {}; winSp = 0; winDr = 0;
  const ct = stats.cat, sum = ['intl', 'dom', 'cdn', 'sat'].reduce((a, k) => a + (ct[k] || 0), 0) || 1;
  ui('mix').innerHTML = ['intl', 'dom', 'cdn', 'sat'].filter(k => ct[k] > 0.5).map(k => `<div class="mx"><i style="background:${FLOW[k].c}"></i><span>${FLOW[k].label}</span><div class="bar"><b style="width:${(ct[k] / sum * 100).toFixed(1)}%;background:${FLOW[k].c}"></b></div><em>${(ct[k] / sum * 100).toFixed(0)}%</em></div>`).join('');
  for (const k in ct) ct[k] *= 0.6;
  for (const n of nodes) if (n.queue) { let l = 0; for (const e of adj.get(n.id)) l += e.load; const f = Math.min(0.999, 0.08 + l / 700 + (scen.ddos && scen.ddos.phase === 1 && n === scen.ddos.target.city ? 0.9 : 0)); n.qf = f; n.queue.material.uniforms.uFill.value = f; n.queue.material.uniforms.uCol.value.set(f > 0.85 ? '#dc2626' : f > 0.6 ? '#d97706' : '#16a34a'); }
  if (layers.heat.visible) drawHeat();
  for (const e of edges) e.load *= 0.5;
  if (inspectNode && ui('iq')) { let l = 0; adj.get(inspectNode.id).forEach(e => l += e.load); ui('iq').style.width = ((inspectNode.qf ?? Math.min(0.9, 0.05 + l / 200)) * 100) + '%'; ui('ipps').textContent = Math.round(l * 2400 * load).toLocaleString() + ' pkt/s'; document.querySelectorAll('#insp [data-e]').forEach(b => { const e = edges[+b.dataset.e]; b.textContent = e.cut ? 'down' : Math.min(99, 4 + e.load * 3).toFixed(0) + '%'; }); }
}, 250);
let heatObj = null;
function drawHeat() {
  if (heatObj) { gHeat.remove(heatObj); heatObj.geometry.dispose(); }
  const segs = [], c1 = new THREE.Color('#16a34a'), c2 = new THREE.Color('#eab308'), c3 = new THREE.Color('#dc2626');
  for (const e of edges) { if (!['fiber', 'microwave', 'aerial', 'subsea', 'xborder', 'mwbackup'].includes(e.type) || !usable(e)) continue; const u = Math.min(1, e.load / (e.type === 'subsea' ? 120 : 45)); const c = u < 0.5 ? c1.clone().lerp(c2, u * 2) : c2.clone().lerp(c3, (u - 0.5) * 2); const st = Math.max(1, Math.floor(e.pts.length / 16)); for (let i = 0; i < e.pts.length - 1; i += st) { const j = Math.min(e.pts.length - 1, i + st); segs.push({ a: lift(e.pts[i], 0.006), b: lift(e.pts[j], 0.006), c: '#' + c.getHexString() }); } }
  heatObj = fatSegs(segs, { vertexColors: true, linewidth: 4, opacity: 0.95 }); gHeat.add(heatObj);
}

/* ---------------- loop ---------------- */
let lastNF = -1; const clock = new THREE.Clock(), tmp = [0, 0, 0]; let tAll = 0;
flyTo('overview', 3200); renderCables();
function frame() {
  const dt = Math.min(0.05, clock.getDelta()); tAll += dt; const sdt = playing ? dt * speed : 0;
  if (fly) { const f = Math.min(1, (performance.now() - fly.s) / fly.dur), e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2; camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0, fly.t1, e); if (f >= 1) fly = null; }
  if (tour && !fly && performance.now() > tourNext) { flyTo(TOUR[tourIdx++ % TOUR.length], 3500); tourNext = performance.now() + 7500; }
  controls.update();
  if (playing) { simHour = (simHour + sdt / 30) % 24; ui('tod').value = simHour; ui('kClock').textContent = fmtClock(simHour); spawnAcc += sdt * 150 * diurnal(simHour); while (spawnAcc > 1) { spawnAcc--; spawnNormal(); } spawnScenario(sdt); }
  for (let i = packets.length - 1; i >= 0; i--) {
    const pk = packets[i]; pk.d += pk.v * sdt;
    if (pk.dropAt !== null && pk.d >= pk.dropAt) { samplePath(pk.path, pk.dropAt, tmp); if (Math.random() < 0.3) burst(new THREE.Vector3(...tmp), '#dc2626', 0.1, 0.5); winDr++; packets.splice(i, 1); continue; }
    if (pk.d >= pk.path.total) { if (pk.sink) { samplePath(pk.path, pk.path.total, tmp); if (Math.random() < 0.2) burst(new THREE.Vector3(...tmp), '#dc2626', 0.22, 0.6); if (scen.hijack) winDr++; } packets.splice(i, 1); }
  }
  let j = 0;
  for (const pk of packets) for (let k = 0; k < TRAIL; k++) {
    samplePath(pk.path, pk.d - k * 0.04, tmp); const o = j * 3; pPos[o] = tmp[0]; pPos[o + 1] = tmp[1]; pPos[o + 2] = tmp[2];
    pCol[o] = pk.col.r; pCol[o + 1] = pk.col.g; pCol[o + 2] = pk.col.b; pSize[j] = pk.size * (1 - k * 0.2); pAlpha[j] = k === 0 ? 1 : 0.5 - k * 0.12; j++;
  }
  pGeo.setDrawRange(0, j); for (const a of ['position', 'aColor', 'aSize', 'aAlpha']) pGeo.attributes[a].needsUpdate = true;
  for (let i = bursts.length - 1; i >= 0; i--) { const b = bursts[i]; b.t += dt; const f = b.t / b.life; if (f >= 1) { gFX.remove(b.m); b.m.material.dispose(); bursts.splice(i, 1); continue; } b.m.scale.setScalar(b.s * (0.3 + f)); b.m.material.opacity = (1 - f) * 0.9; }
  hiLines.forEach(l => { if (l.userData.anim) l.material.dashOffset -= dt * 0.5; });
  gGate.children.forEach(m => { if (m.userData.spin) m.userData.spin.rotation.z += dt; });
  const dist = camera.position.distanceTo(controls.target);
  const nf = Math.min(1.3, Math.max(0.28, dist / 14));
  if (Math.abs(nf - lastNF) > 0.01) { lastNF = nf; for (const n of nodes) if (n.mesh && n.tier !== 'sat') n.mesh.scale.setScalar(nf); setAccScale(Math.max(0.4, nf)); }
  for (const o of labelObjs) { const v = dist >= o.userData.minD && dist <= o.userData.maxD; if (o.visible !== v) o.visible = v; }
  for (const [l, g] of boundLabels) if (!g.visible) l.visible = false;
  if (hoverPending) { const n = pick(); hoverNode = n; tip(n, ...hoverPending); renderer.domElement.style.cursor = n ? 'pointer' : ''; hoverPending = null; }
  renderer.render(scene, camera); labelRenderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); labelRenderer.setSize(innerWidth, innerHeight); lineMats.forEach(m => m.resolution.set(innerWidth, innerHeight)); });

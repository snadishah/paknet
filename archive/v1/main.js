import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import COUNTRIES from '../../data/countries.json';
import PROVEDGES from '../../data/provedges.json';
import CITIES from '../../data/cities.json';

/* ============================================================
   PROJECTION  (equirectangular, cos-latitude corrected)
   ============================================================ */
const LON0 = 69.3, LAT0 = 30.2, KX = Math.cos(LAT0 * Math.PI / 180);
const LAND = 0.10, NET = 0.145;
const KM_PER_UNIT = 111;
const P = (lon, lat, z = 0) => new THREE.Vector3((lon - LON0) * KX, lat - LAT0, z);

const COL = {
  core: '#7af3ff', agg: '#3aa8ff', access: '#8fb8ff', cls: '#ff8a3d', ixp: '#ffd166',
  dc: '#c08bff', sat: '#ff9cf2', mw: '#ff7de9', fiber: '#36c8ff', planned: '#ffb347',
  xb: '#a6ff6b', attack: '#ff3355', ok: '#4dffb5'
};
const OPS = {
  PTCL: '#2f9bff', TWA: '#ff8a3d', Cybernet: '#ffc43d', Multinet: '#00e0b0',
  Wateen: '#c77dff', Nayatel: '#ff5d8f', SCO: '#a6ff6b'
};
const FLOW = {
  out: { c: '#33b6ff', label: 'International ↑ (upload)' },
  in: { c: '#5cf2ff', label: 'International ↓ (download)' },
  dom: { c: '#ffd36b', label: 'Domestic ISP↔ISP' },
  cdn: { c: '#ffa64d', label: 'Local CDN cache hit' },
  sat: { c: '#ff9cf2', label: 'Satellite (VSAT)' },
  cn: { c: '#a6ff6b', label: 'China OFC (Khunjerab)' },
  xb: { c: '#d0ff8a', label: 'Cross-border (AFG/IRN)' },
  atk: { c: '#ff3355', label: 'Attack / hijacked' },
  loop: { c: '#ff9a3d', label: 'Routing loop' }
};

/* ============================================================
   RENDERER / SCENE
   ============================================================ */
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x030711, 1);
app.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.className = 'labels';
app.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 400);
camera.up.set(0, 0, 1);
camera.position.set(0, -4, 60);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.screenSpacePanning = false;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.maxPolarAngle = 1.22; controls.minDistance = 0.8; controls.maxDistance = 55;
controls.target.set(0, -1.6, 0);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.45, 0.42);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const lineMats = [];
function lmat(o) { const m = new LineMaterial(Object.assign({ worldUnits: false, transparent: true, depthWrite: false }, o)); m.resolution.set(window.innerWidth, window.innerHeight); lineMats.push(m); return m; }
function fatLine(pts, o) {
  const g = new LineGeometry(); g.setPositions(pts.flatMap(p => [p.x, p.y, p.z]));
  const l = new Line2(g, lmat(o)); if (o.dashed) l.computeLineDistances(); return l;
}
function fatSegs(segs, o) { // segs: [{a,b,ca,cb}]
  const g = new LineSegmentsGeometry();
  g.setPositions(segs.flatMap(s => [s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z]));
  if (o.vertexColors) g.setColors(segs.flatMap(s => { const a = new THREE.Color(s.ca), b = new THREE.Color(s.cb || s.ca); return [a.r, a.g, a.b, b.r, b.g, b.b]; }));
  const l = new LineSegments2(g, lmat(o)); if (o.dashed) l.computeLineDistances(); return l;
}

const layers = {};
function layer(name) { const g = new THREE.Group(); g.name = name; scene.add(g); layers[name] = g; return g; }

/* ============================================================
   BASEMAP: sea, neighbours, Pakistan terrain, provinces, Indus
   ============================================================ */
const gBase = layer('base');
const seaMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform float uTime; varying vec3 vP;
  float line(float v,float w){ float f=abs(fract(v)-.5); return smoothstep(.5-w,.5,f); }
  void main(){
    vec2 p=vP.xy; float r=length(p-vec2(0.,-2.));
    vec3 c=mix(vec3(.012,.035,.075),vec3(.004,.010,.025),smoothstep(4.,34.,r));
    float g=max(line(p.x/2.,.012),line(p.y/2.,.012));
    c+=vec3(.05,.13,.22)*g*(1.-smoothstep(6.,26.,r));
    float w=sin(p.x*3.1+uTime*.6)*sin(p.y*2.7-uTime*.45);
    c+=vec3(.0,.03,.05)*smoothstep(.6,1.,w)*(1.-smoothstep(4.,18.,r));
    gl_FragColor=vec4(c,1.);
  }`
});
const sea = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), seaMat); sea.position.z = -0.02; gBase.add(sea);

function ringToShape(ring) { return ring.map(([lo, la]) => { const v = P(lo, la); return new THREE.Vector2(v.x, v.y); }); }
function polysToShapes(polys) {
  return polys.map(poly => { const s = new THREE.Shape(ringToShape(poly[0])); poly.slice(1).forEach(h => s.holes.push(new THREE.Path(ringToShape(h)))); return s; });
}
// neighbours
const nbMat = new THREE.MeshBasicMaterial({ color: 0x08111f });
for (const k of ['IND', 'AFG', 'IRN', 'CHN', 'OMN', 'TJK', 'ARE']) {
  if (!COUNTRIES[k]) continue;
  const m = new THREE.Mesh(new THREE.ShapeGeometry(polysToShapes(COUNTRIES[k])), nbMat); gBase.add(m);
  COUNTRIES[k].forEach(poly => gBase.add(fatLine(poly[0].map(([lo, la]) => P(lo, la, 0.004)), { color: 0x24405e, linewidth: 1, opacity: 0.7 })));
}
// Pakistan terrain
const landMat = new THREE.ShaderMaterial({
  uniforms: { uDim: { value: 1 } },
  vertexShader: `varying vec3 vP; varying vec3 vN; void main(){ vP=position; vN=normal; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform float uDim; varying vec3 vP; varying vec3 vN;
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<6;i++){s+=a*n(p);p*=2.05;a*=.5;}return s;}
  void main(){
    vec2 p=vP.xy;
    float north=smoothstep(2.2,6.2,p.y+0.30*p.x);
    float west=smoothstep(-0.5,-5.5,p.x)*smoothstep(-6.,1.5,p.y)*.75;
    float salt=smoothstep(1.2,.2,abs(p.y-2.6+.1*p.x))*smoothstep(4.5,1.5,abs(p.x-2.2))*.35;
    float m=fbm(p*2.4);
    float ridge=1.-abs(fbm(p*4.1+3.)*2.-1.);
    float relief=(north*(.55+.8*ridge*m)+west*m+salt*m);
    vec3 plains=vec3(.030,.078,.120);
    vec3 hills=vec3(.075,.135,.180);
    vec3 snow=vec3(.19,.26,.32);
    vec3 c=mix(plains,hills,clamp(relief*1.25,0.,1.));
    c=mix(c,snow,smoothstep(.62,.95,north*ridge*m*1.6));
    float thar=smoothstep(1.6,.2,length((p-vec2(1.15,-5.3))*vec2(.9,1.3)));
    c=mix(c,vec3(.10,.09,.075),thar*.45);
    if(vN.z<.5) c=vec3(.02,.08,.13)*(1.+.6*smoothstep(-.0,.1,vP.z));
    gl_FragColor=vec4(c*uDim,1.);
  }`
});
const pakShapes = polysToShapes(COUNTRIES.PAK);
const land = new THREE.Mesh(new THREE.ExtrudeGeometry(pakShapes, { depth: LAND, bevelEnabled: false }), landMat);
gBase.add(land);
const pakRings = COUNTRIES.PAK.map(poly => poly[0]);
const mainRing = pakRings.reduce((a, b) => (a.length > b.length ? a : b));
pakRings.forEach(r => {
  const pts = r.map(([lo, la]) => P(lo, la, LAND + 0.004));
  gBase.add(fatLine(pts, { color: 0x6ff2ff, linewidth: 2.2, opacity: 0.95 }));
  gBase.add(fatLine(pts, { color: 0x1aa6ff, linewidth: 9, opacity: 0.16 }));
});
// glow curtain under border
{
  const pts = mainRing.map(([lo, la]) => P(lo, la, 0));
  const pos = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; pos.push(a.x, a.y, -0.01, b.x, b.y, -0.01, b.x, b.y, LAND, a.x, a.y, -0.01, b.x, b.y, LAND, a.x, a.y, LAND); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.ShaderMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying float vZ; void main(){ vZ=position.z; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying float vZ; void main(){ gl_FragColor=vec4(.1,.6,1.,.28*smoothstep(0.,.1,vZ)); }` });
  gBase.add(new THREE.Mesh(g, m));
}
const gProv = layer('prov');
gProv.add(fatSegs(PROVEDGES.map(([a, b]) => ({ a: P(a[0], a[1], LAND + 0.003), b: P(b[0], b[1], LAND + 0.003) })), { color: 0x4cc9ff, linewidth: 1.1, opacity: 0.45, dashed: true, dashSize: 0.06, gapSize: 0.05 }));
// Indus (approximate course)
const INDUS = [[76.2, 34.75], [75.63, 35.30], [75.0, 35.55], [74.6, 35.75], [74.1, 35.42], [73.29, 35.29], [72.88, 34.93], [72.70, 34.08], [72.25, 33.90], [71.53, 32.96], [71.55, 32.58], [70.92, 31.83], [70.65, 30.70], [70.37, 28.95], [69.70, 28.42], [68.86, 27.70], [67.87, 26.42], [68.33, 25.37], [68.0, 24.75], [67.45, 24.05]];
{
  const curve = new THREE.CatmullRomCurve3(INDUS.map(([lo, la]) => P(lo, la, LAND + 0.002)));
  gProv.add(fatLine(curve.getPoints(220), { color: 0x2b7bff, linewidth: 2.2, opacity: 0.55 }));
}
// city-lights density layer
const glowTex0 = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
const gLights = layer('lights');
function inRing(lon, lat, ring) { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) ins = !ins; } return ins; }
function inPak(lon, lat) { return pakRings.some(r => inRing(lon, lat, r)); }

/* ============================================================
   CITIES  (GeoNames: every Pakistani place in the dataset)
   ============================================================ */
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
{ // lights
  const step = 0.045, acc = new Map();
  for (const c of cities) {
    if (c.p < 8000) continue;
    const sig = 0.035 + 0.11 * Math.pow(c.p / 1e6, 0.42), R = sig * 3;
    for (let x = c.lon - R; x <= c.lon + R; x += step) for (let y = c.lat - R; y <= c.lat + R; y += step) {
      const gx = Math.round(x / step), gy = Math.round(y / step), k = gx + ',' + gy;
      const dx = gx * step - c.lon, dy = gy * step - c.lat;
      const v = Math.pow(c.p / 3e5, 0.55) * Math.exp(-(dx * dx + dy * dy) / (sig * sig));
      acc.set(k, (acc.get(k) || 0) + v);
    }
  }
  const pos = [], col = [];
  const warm = new THREE.Color('#ffc46b'), hot = new THREE.Color('#fff3d6');
  for (const [k, v] of acc) {
    if (v < 0.06) continue; const [gx, gy] = k.split(',').map(Number); const lon = gx * step, lat = gy * step;
    if (!inPak(lon, lat)) continue;
    const p = P(lon, lat, LAND + 0.006); pos.push(p.x, p.y, p.z);
    const t = Math.min(1, v / 2.2); const c = warm.clone().lerp(hot, t).multiplyScalar(0.25 + 0.75 * Math.min(1, v)); col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  gLights.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.05, map: glowTex0, vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })));
}

/* ============================================================
   GRAPH  (representative topology — real internal topology is not public)
   ============================================================ */
const nodes = [], edges = [], adj = new Map();
const byName = {};
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
  const tier = CORE.includes(c.n) ? 'core' : AGG.includes(c.n) ? 'agg' : 'access';
  addNode({ name: c.n, lon: c.lon, lat: c.lat, pop: c.p, tier, kind: 'city' });
}
const N = n => byName[n];
// representative carrier assignment per corridor
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
R(['Quetta', 'Loralai', 'Dera Ghazi Khan'], 'fiber', ['PTCL']);
R(['Quetta', 'Zhob', 'Dera Ismail Khan'], 'fiber', ['PTCL']);
R(['Hub', 'Ormara', 'Pasni', 'Gwadar'], 'fiber', ['PTCL']);
R(['Gwadar', 'Turbat', 'Panjgur'], 'fiber', ['PTCL']);
R(['Quetta', 'Nushki', 'Dalbandin', 'Nok Kundi', 'Taftan'], 'fiber', ['PTCL']);
R(['Karachi', 'Thatta', 'Badin', 'Hyderabad'], 'fiber', ['PTCL']); R(['Hyderabad', 'Mirpur Khas', 'Umarkot'], 'fiber', ['PTCL']);
R(['Peshawar', 'Mardan', 'Mingora'], 'fiber', ['PTCL', 'Nayatel']);
R(['Islamabad', 'Muzaffarabad'], 'fiber', ['SCO', 'PTCL']); R(['Jhelum', 'New Mirpur', 'Kotli', 'Rawalakot', 'Muzaffarabad'], 'fiber', ['SCO']);
// Pak-China OFC (SCO): underground fibre Rawalpindi → Karimabad, aerial Karimabad → Khunjerab
R(['Rawalpindi', 'Abbottabad', 'Mansehra', 'Besham', 'Dasu', 'Chilas', 'Gilgit', 'Karimabad'], 'fiber', ['SCO']);
R(['Karimabad', 'Sost', 'Khunjerab Pass'], 'aerial', ['SCO']);
// microwave (last-mile/remote)
R(['Umarkot', 'Mithi'], 'microwave', ['PTCL']); R(['Mingora', 'Chitral'], 'microwave', ['PTCL']);
R(['Gilgit', 'Skardu'], 'microwave', ['SCO']); R(['Panjgur', 'Kharan', 'Nushki'], 'microwave', ['PTCL']);
R(['Khuzdar', 'Awaran', 'Turbat'], 'microwave', ['PTCL']);
// microwave backup: 26 nodes Rawalpindi → Karimabad (SCO)
const towers = [];
{
  const path = ['Rawalpindi', 'Abbottabad', 'Mansehra', 'Besham', 'Dasu', 'Chilas', 'Gilgit', 'Karimabad'].map(n => N(n).pos);
  const curve = new THREE.CatmullRomCurve3(path, false, 'catmullrom', 0.2);
  let prev = N('Rawalpindi');
  for (let i = 1; i <= 26; i++) {
    const t = i / 27; const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    const off = new THREE.Vector3(-tan.y, tan.x, 0).normalize().multiplyScalar(0.13 + 0.04 * Math.sin(i * 1.7));
    const tw = addNode({ name: `MW relay ${i}`, pos: p.clone().add(off).setZ(NET), tier: 'tower', kind: 'tower', lon: 0, lat: 0, op: 'SCO' });
    towers.push(tw); addEdge(prev, tw, 'microwave', ['SCO']); prev = tw;
  }
  addEdge(prev, N('Karimabad'), 'microwave', ['SCO']);
}
// Karachi gateway: landing stations, IGW, IXPs, data centres
const CLS = {
  ptclHB: addNode({ name: "PTCL CLS · Hawke's Bay", lon: 66.875, lat: 24.845, tier: 'cls', kind: 'cls', op: 'PTCL' }),
  ptclSV: addNode({ name: 'PTCL CLS · Sea View / Clifton', lon: 67.035, lat: 24.792, tier: 'cls', kind: 'cls', op: 'PTCL' }),
  twa: addNode({ name: 'TWA CLS · Hawke\'s Bay (Keamari)', lon: 66.83, lat: 24.89, tier: 'cls', kind: 'cls', op: 'TWA' }),
  cyber: addNode({ name: 'Cybernet CLS (PEACE) · approx.', lon: 66.955, lat: 24.815, tier: 'cls', kind: 'cls', op: 'Cybernet' }),
  gwadar: addNode({ name: 'Gwadar CLS (planned)', lon: 62.33, lat: 25.10, tier: 'cls', kind: 'cls', op: 'SCO', planned: true })
};
for (const k of ['ptclHB', 'ptclSV', 'twa', 'cyber']) addEdge(CLS[k], N('Karachi'), 'metro', [CLS[k].op]);
addEdge(CLS.gwadar, N('Gwadar'), 'planned', ['SCO']);
const IXP = [['PKIX Islamabad', 'Islamabad', 0.07, 0.05], ['PKIX Karachi', 'Karachi', 0.12, 0.13], ['PKIX Lahore', 'Lahore', 0.08, 0.05]].map(([n, c, dx, dy]) => {
  const city = N(c); const o = addNode({ name: n, pos: city.pos.clone().add(new THREE.Vector3(dx, dy, 0.05)), tier: 'ixp', kind: 'ixp', lon: city.lon, lat: city.lat });
  addEdge(o, city, 'metro', []); o.city = city; return o;
});
const DCS = [['Cloudflare edge · Karachi', 'Karachi', -0.04, 0.16], ['Cloudflare edge · Lahore', 'Lahore', -0.08, 0.06], ['Cloudflare edge · Islamabad', 'Islamabad', -0.08, 0.04], ['TWA Tier III DC · Karachi', 'Karachi', -0.2, 0.1]].map(([n, c, dx, dy]) => {
  const city = N(c); const o = addNode({ name: n, pos: city.pos.clone().add(new THREE.Vector3(dx, dy, 0.03)), tier: 'dc', kind: 'dc', lon: city.lon, lat: city.lat });
  addEdge(o, city, 'metro', []); o.city = city; return o;
});
// international endpoints
const INTL = {
  W: addNode({ name: 'Gulf · Red Sea · Europe', lon: 56.6, lat: 24.9, tier: 'intl', kind: 'intl' }),
  E: addNode({ name: 'India · Sri Lanka · Singapore', lon: 72.9, lat: 17.6, tier: 'intl', kind: 'intl' }),
  SW: addNode({ name: 'Djibouti · East Africa', lon: 57.2, lat: 15.6, tier: 'intl', kind: 'intl' }),
  N: addNode({ name: 'Urumqi · China (TEA network)', lon: 76.6, lat: 37.9, tier: 'intl', kind: 'intl' }),
  AF: addNode({ name: 'Afghanistan (Jalalabad · Kabul)', lon: 70.0, lat: 34.75, tier: 'intl', kind: 'intl' }),
  AFS: addNode({ name: 'Afghanistan (Kandahar)', lon: 65.7, lat: 31.4, tier: 'intl', kind: 'intl' }),
  IR: addNode({ name: 'Iran (Zahedan)', lon: 60.5, lat: 29.55, tier: 'intl', kind: 'intl' })
};
addEdge(N('Khunjerab Pass'), INTL.N, 'aerial', ['SCO']);
addEdge(N('Torkham'), INTL.AF, 'xborder', ['PTCL']); addEdge(N('Peshawar'), N('Torkham'), 'fiber', ['PTCL']);
addEdge(N('Chaman'), INTL.AFS, 'xborder', ['PTCL']); addEdge(N('Taftan'), INTL.IR, 'xborder', ['PTCL']);
// submarine cables (all land in Karachi; status per late-2025 reports)
const CABLES = [
  { id: 'SMW4', name: 'SEA-ME-WE 4', cls: 'ptclHB', op: 'PTCL', dirs: ['W', 'E'], status: 'live', share: 0.13 },
  { id: 'IMEWE', name: 'IMEWE', cls: 'ptclHB', op: 'PTCL', dirs: ['W', 'E'], status: 'live', share: 0.10 },
  { id: 'AAE1', name: 'AAE-1', cls: 'ptclSV', op: 'PTCL', dirs: ['W', 'E'], status: 'live', share: 0.17 },
  { id: 'AFR1', name: 'Africa-1', cls: 'ptclSV', op: 'PTCL', dirs: ['SW'], status: 'landed', share: 0.04 },
  { id: 'SMW5', name: 'SEA-ME-WE 5', cls: 'twa', op: 'TWA', dirs: ['W', 'E'], status: 'live', share: 0.16 },
  { id: 'TW1', name: 'TW1', cls: 'twa', op: 'TWA', dirs: ['W'], status: 'live', share: 0.07 },
  { id: 'SMW6', name: 'SEA-ME-WE 6', cls: 'twa', op: 'TWA', dirs: ['W', 'E'], status: 'live', share: 0.20 },
  { id: '2AFR', name: '2Africa (Pearls)', cls: 'twa', op: 'TWA', dirs: ['SW'], status: 'landed', share: 0.04 },
  { id: 'PEACE', name: 'PEACE', cls: 'cyber', op: 'Cybernet', dirs: ['SW'], status: 'live', share: 0.09 },
  { id: 'SMW3', name: 'SEA-ME-WE 3', cls: 'ptclHB', op: 'PTCL', dirs: ['W'], status: 'retired', share: 0 }
];
const CAB_COL = { SMW4: '#2f9bff', IMEWE: '#4fc3ff', AAE1: '#00e5ff', AFR1: '#5ad1ff', SMW5: '#ff8a3d', TW1: '#ffb36b', SMW6: '#ff5f3d', '2AFR': '#ffcf6b', PEACE: '#ffe14d', SMW3: '#55657a' };
const DIR_ROUTE = {
  W: [[66.55, 24.45], [65.2, 24.25], [62.5, 24.45], [59.5, 24.75], [56.6, 24.9]],
  E: [[66.95, 24.25], [67.8, 22.6], [69.8, 20.6], [72.9, 17.6]],
  SW: [[66.4, 24.25], [64.6, 22.6], [61.2, 19.4], [57.2, 15.6]]
};
const cableEdges = [];
CABLES.forEach((c, i) => {
  c.edges = [];
  for (const d of c.dirs) {
    const start = CLS[c.cls].pos.clone().setZ(0.012);
    const k = (i - 4.5) * 0.055;
    const ctrl = DIR_ROUTE[d].map(([lo, la], j) => {
      const f = j === DIR_ROUTE[d].length - 1 ? 0.25 : 1;
      const v = P(lo, la, 0.012); if (d === 'W') v.y += k * f * 1.6; else if (d === 'E') v.x += k * f * 1.6; else { v.x += k * f; v.y -= k * f; }
      return v;
    });
    const curve = new THREE.CatmullRomCurve3([CLS[c.cls].pos, start, ...ctrl], false, 'centripetal');
    const e = addEdge(CLS[c.cls], INTL[d], 'subsea', [c.op], curve.getPoints(90), { cable: c, dir: d });
    c.edges.push(e); cableEdges.push(e);
  }
});
// planned Gwadar cable + CPEC Phase-II fibre Rawalpindi → Gwadar
const plannedEdges = [];
{
  const curve = new THREE.CatmullRomCurve3([CLS.gwadar.pos, P(62.2, 24.6, 0.012), P(60.2, 24.55, 0.012), P(58.3, 24.8, 0.012), INTL.W.pos.clone().setZ(0.012)], false, 'centripetal');
  const e = addEdge(CLS.gwadar, INTL.W, 'planned', ['SCO'], curve.getPoints(60), { plannedCable: true }); plannedEdges.push(e);
  const names = ['Rawalpindi', 'Dera Ismail Khan', 'Zhob', 'Quetta', 'Kalat', 'Panjgur', 'Turbat', 'Gwadar'];
  for (let i = 0; i < names.length - 1; i++) {
    const a = N(names[i]), b = N(names[i + 1]); const off = new THREE.Vector3(0.05, -0.05, 0);
    plannedEdges.push(addEdge(a, b, 'planned', ['SCO'], [a.pos.clone().add(off), b.pos.clone().add(off)]));
  }
  plannedEdges.push(edges[edges.length - 1]);
  plannedEdges.forEach(e => e.planned = true);
}
// satellite PakSat-MM1 (GEO 38.2°E — drawn high in the western sky)
const SAT = addNode({ name: 'PakSat-MM1 (GEO 38.2°E)', pos: P(62.3, 30.2, 3.4), tier: 'sat', kind: 'sat', lon: 38.2, lat: 0 });
const GW = ['Karachi', 'Lahore', 'Islamabad'].map(c => { const city = N(c); const g = addNode({ name: `Teleport gateway · ${c}`, pos: city.pos.clone().add(new THREE.Vector3(0.1, -0.08, 0.02)), tier: 'gw', kind: 'gw', lon: city.lon, lat: city.lat }); addEdge(g, city, 'metro', []); g.city = city; return g; });
const VSAT = ['Chitral', 'Skardu', 'Mithi', 'Panjgur', 'Kharan', 'Awaran', 'Dalbandin', 'Zhob', 'Sost', 'Nok Kundi'].map(c => { const city = N(c); const v = addNode({ name: `VSAT · ${c}`, pos: city.pos.clone().add(new THREE.Vector3(0.05, 0.05, 0.02)), tier: 'vsat', kind: 'vsat', lon: city.lon, lat: city.lat }); addEdge(v, city, 'metro', []); v.city = city; return v; });
function satCurve(a, b) { const mid = a.clone().lerp(b, 0.5); mid.z += 1.5; return new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(40); }
[...GW, ...VSAT].forEach(g => addEdge(g, SAT, 'sat', ['PakSat'], satCurve(g.pos, SAT.pos)));
// access / last mile: each small city homes to nearest aggregation/core router
const hubs = nodes.filter(n => n.kind === 'city' && (n.tier === 'core' || n.tier === 'agg'));
for (const n of nodes.filter(n => n.kind === 'city' && n.tier === 'access')) {
  let best = null, bd = 1e9; for (const h of hubs) { const d = h.pos.distanceToSquared(n.pos); if (d < bd) { bd = d; best = h; } }
  const remote = (n.lon < 67.6 && n.lat > 25.3) || n.lat > 34.9 || Math.sqrt(bd) > 0.7; n.remote = remote;
  addEdge(n, best, remote ? 'mwaccess' : 'access', []);
  n.parent = best;
}
// orphan agg nodes w/o edges: connect to nearest core/agg with edges
for (const n of hubs) if (adj.get(n.id).filter(e => e.type !== 'access' && e.type !== 'mwaccess').length === 0) {
  let best = null, bd = 1e9; for (const h of hubs) { if (h === n || adj.get(h.id).length < 2) continue; const d = h.pos.distanceToSquared(n.pos); if (d < bd) { bd = d; best = h; } }
  addEdge(n, best, 'fiber', ['PTCL']);
}

/* ============================================================
   DRAW NETWORK
   ============================================================ */
const gCables = layer('cables'), gBackbone = layer('backbone'), gMW = layer('microwave'), gSat = layer('satellite'),
  gXB = layer('xborder'), gPlanned = layer('planned'), gAccess = layer('access'), gRouters = layer('routers'), gIXP = layer('ixp'),
  gPackets = layer('packets'), gHeat = layer('heat'), gFX = layer('fx'), gLabels = layer('labels');
gHeat.visible = false;

function perp(a, b) { return new THREE.Vector3(-(b.y - a.y), b.x - a.x, 0).normalize(); }
{ // backbone bundles
  const segs = [], glow = [];
  for (const e of edges.filter(e => e.type === 'fiber')) {
    const a = e.pts[0], b = e.pts[e.pts.length - 1], pp = perp(a, b); const n = e.ops.length;
    glow.push({ a, b, ca: '#1d7dff' });
    e.ops.forEach((op, i) => { const o = pp.clone().multiplyScalar((i - (n - 1) / 2) * 0.022); segs.push({ a: a.clone().add(o), b: b.clone().add(o), ca: OPS[op] || '#36c8ff' }); });
  }
  gBackbone.add(fatSegs(glow, { color: 0x1d7dff, linewidth: 7, opacity: 0.12 }));
  gBackbone.add(fatSegs(segs, { vertexColors: true, linewidth: 1.5, opacity: 0.95 }));
  const aer = edges.filter(e => e.type === 'aerial').map(e => ({ a: e.pts[0], b: e.pts[e.pts.length - 1], ca: COL.xb }));
  gXB.add(fatSegs(aer, { vertexColors: true, linewidth: 2, opacity: 0.95, dashed: true, dashSize: 0.05, gapSize: 0.03 }));
  const xb = edges.filter(e => e.type === 'xborder').map(e => ({ a: e.pts[0], b: e.pts[e.pts.length - 1], ca: COL.xb }));
  gXB.add(fatSegs(xb, { vertexColors: true, linewidth: 1.6, opacity: 0.8, dashed: true, dashSize: 0.08, gapSize: 0.06 }));
  const mw = edges.filter(e => e.type === 'microwave').map(e => ({ a: e.pts[0].clone().setZ(NET + 0.06), b: e.pts[1].clone().setZ(NET + 0.06), ca: COL.mw }));
  gMW.add(fatSegs(mw, { vertexColors: true, linewidth: 1.3, opacity: 0.9, dashed: true, dashSize: 0.035, gapSize: 0.03 }));
  const acc = [], accMW = [];
  for (const e of edges.filter(e => e.type === 'access' || e.type === 'mwaccess')) (e.type === 'access' ? acc : accMW).push(e.pts[0].x, e.pts[0].y, NET - 0.02, e.pts[1].x, e.pts[1].y, NET - 0.02);
  const ga = new THREE.BufferGeometry(); ga.setAttribute('position', new THREE.Float32BufferAttribute(acc, 3));
  gAccess.add(new THREE.LineSegments(ga, new THREE.LineBasicMaterial({ color: 0x3f86c9, transparent: true, opacity: 0.38 })));
  const gm = new THREE.BufferGeometry(); gm.setAttribute('position', new THREE.Float32BufferAttribute(accMW, 3));
  const lm = new THREE.LineSegments(gm, new THREE.LineDashedMaterial({ color: 0xc46bd6, transparent: true, opacity: 0.45, dashSize: 0.03, gapSize: 0.025 })); lm.computeLineDistances(); gAccess.add(lm);
  // metro rings
  for (const c of ['Karachi', 'Lahore', 'Islamabad', 'Faisalabad', 'Rawalpindi', 'Multan', 'Peshawar', 'Quetta', 'Hyderabad']) {
    const n = N(c); const r = ['Karachi', 'Lahore'].includes(c) ? 0.16 : 0.09; const pts = [];
    for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; pts.push(new THREE.Vector3(n.pos.x + Math.cos(a) * r, n.pos.y + Math.sin(a) * r, NET - 0.01)); }
    gAccess.add(fatLine(pts, { color: 0x41e0ff, linewidth: 1, opacity: 0.45 }));
  }
}
// subsea cables
for (const e of cableEdges) {
  const c = e.cable; const col = CAB_COL[c.id];
  const dashed = c.status !== 'live';
  e.line = fatLine(e.pts, { color: col, linewidth: c.status === 'retired' ? 1.2 : 2.4, opacity: c.status === 'retired' ? 0.45 : 0.95, dashed, dashSize: 0.12, gapSize: 0.08 });
  e.glow = fatLine(e.pts, { color: col, linewidth: 8, opacity: c.status === 'live' ? 0.13 : 0.05 });
  gCables.add(e.glow, e.line);
}
// planned
for (const e of plannedEdges) gPlanned.add(fatLine(e.pts.map(p => p.clone().setZ(Math.max(p.z, 0.012))), { color: COL.planned, linewidth: 1.8, opacity: 0.85, dashed: true, dashSize: 0.09, gapSize: 0.07 }));
// satellite
{
  const body = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.3), new THREE.MeshBasicMaterial({ color: 0xffd9f6 }));
  const pm = new THREE.MeshBasicMaterial({ color: 0x3b6cff, side: THREE.DoubleSide });
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.26), pm); p1.position.x = 0.62; p1.rotation.x = Math.PI / 2;
  const p2 = p1.clone(); p2.position.x = -0.62;
  const dish = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.08, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  dish.position.z = -0.2; dish.rotation.x = Math.PI / 2;
  body.add(box, p1, p2, dish); body.position.copy(SAT.pos); gSat.add(body); SAT.mesh = body;
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), new THREE.MeshBasicMaterial({ color: 0xff9cf2, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.copy(SAT.pos); gSat.add(halo);
  for (const e of edges.filter(e => e.type === 'sat')) gSat.add(fatLine(e.pts, { color: COL.sat, linewidth: 1.1, opacity: 0.55, dashed: true, dashSize: 0.1, gapSize: 0.07 }));
  // spot-beam cones (11 Ka-band spot beams in reality; a few drawn)
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff9cf2, transparent: true, opacity: 0.006, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const [lo, la, r] of [[71.8, 35.6, 0.9], [75.2, 35.6, 0.9], [69.9, 24.9, 0.8], [64.5, 27.0, 1.1], [65.2, 29.4, 1.0], [69.6, 31.2, 0.9]]) {
    const g = P(lo, la, LAND); const h = SAT.pos.distanceTo(g);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 40, 1, true), beamMat);
    cone.position.copy(SAT.pos.clone().lerp(g, 0.5)); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), g.clone().sub(SAT.pos).normalize());
    gSat.add(cone);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.96, r, 64), new THREE.MeshBasicMaterial({ color: 0xff9cf2, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.position.copy(g).setZ(LAND + 0.01); gSat.add(ring);
  }
}
// router meshes
const pickables = [];
const pulseRings = [];
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
function glowSprite(color, s) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.set(s, s, s); return sp; }
const queueMat = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uFill: { value: 0.3 }, uCol: { value: new THREE.Color('#4dffb5') } },
  vertexShader: `varying vec2 vU; void main(){ vU=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform float uFill; uniform vec3 uCol; varying vec2 vU; void main(){ float a=atan(vU.x,vU.y)/6.2831853+.5; if(a>uFill) discard; gl_FragColor=vec4(uCol,.9); }` });
for (const n of nodes) {
  let m = null;
  if (n.tier === 'core') {
    m = new THREE.Group();
    const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.22, 6), new THREE.MeshBasicMaterial({ color: 0xbaf8ff }));
    hex.rotation.x = Math.PI / 2; hex.position.z = 0.11; m.add(hex);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 1.1, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x5ee7ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.rotation.x = Math.PI / 2; beam.position.z = 0.6; m.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.15, 48), new THREE.MeshBasicMaterial({ color: 0x5ee7ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.position.z = 0.005; m.add(ring); pulseRings.push(ring);
    const q = new THREE.Mesh(new THREE.RingGeometry(0.19, 0.22, 64), queueMat()); q.position.z = 0.01; m.add(q); n.queue = q;
    m.add(glowSprite(0x5ee7ff, 0.34));
  } else if (n.tier === 'agg') {
    m = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.09, 6), new THREE.MeshBasicMaterial({ color: 0x59b8ff }));
    c.rotation.x = Math.PI / 2; c.position.z = 0.045; m.add(c); m.add(glowSprite(0x2f9bff, 0.22));
    const q = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.085, 48), queueMat()); q.position.z = 0.005; m.add(q); n.queue = q;
  } else if (n.tier === 'cls') {
    m = new THREE.Group();
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.08), new THREE.MeshBasicMaterial({ color: n.planned ? 0xffb347 : 0xff9a4d }));
    t.position.z = 0.04; m.add(t); m.add(glowSprite(n.planned ? 0xffb347 : 0xff8a3d, 0.25));
  } else if (n.tier === 'ixp') {
    m = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xffd166 })); m.userData.spin = true;
    const s = glowSprite(0xffd166, 0.25); m.add(s);
  } else if (n.tier === 'dc') {
    m = new THREE.Group();
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.018), new THREE.MeshBasicMaterial({ color: i === 2 ? 0xe7d4ff : 0xb07cff })); b.position.z = 0.012 + i * 0.024; m.add(b); }
    m.add(glowSprite(0xb07cff, 0.2));
  } else if (n.tier === 'gw' || n.tier === 'vsat') {
    m = new THREE.Group();
    const d = new THREE.Mesh(new THREE.SphereGeometry(n.tier === 'gw' ? 0.045 : 0.03, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff9cf2, side: THREE.DoubleSide }));
    d.rotation.x = -0.9; d.position.z = 0.03; m.add(d); m.add(glowSprite(0xff9cf2, 0.16));
    (gSat).add(m); m.position.copy(n.pos); n.mesh = m; m.traverse(o => { o.userData.node = n; }); pickables.push(m); continue;
  } else if (n.tier === 'intl') {
    m = new THREE.Group(); m.add(glowSprite(0x7af3ff, 0.8));
    const r = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.19, 48), new THREE.MeshBasicMaterial({ color: 0x7af3ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending })); m.add(r); pulseRings.push(r);
  } else if (n.tier === 'tower') {
    m = new THREE.Group();
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.12, 4), new THREE.MeshBasicMaterial({ color: 0xff7de9 })); t.rotation.x = Math.PI / 2; t.position.z = 0.03; m.add(t);
    m.add(glowSprite(0xff7de9, 0.1)); gMW.add(m); m.position.copy(n.pos).setZ(NET); n.mesh = m; m.traverse(o => { o.userData.node = n; }); pickables.push(m); continue;
  }
  if (!m) continue;
  m.position.copy(n.pos); n.mesh = m; m.traverse(o => { o.userData.node = n; });
  (n.tier === 'ixp' || n.tier === 'dc' ? gIXP : n.tier === 'cls' && n.planned ? gPlanned : gRouters).add(m); pickables.push(m);
}
// access nodes: instanced
const accessNodes = nodes.filter(n => n.kind === 'city' && n.tier === 'access');
const accMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.018), new THREE.MeshBasicMaterial({ color: 0xffffff }), accessNodes.length);
{
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  window.__accScale = (f) => accessNodes.forEach((n, i) => { const s = f * (0.7 + Math.min(1.4, Math.pow(n.pop / 60000, 0.35))); m4.makeScale(s, s, s).setPosition(n.pos.x, n.pos.y, NET); accMesh.setMatrixAt(i, m4); accMesh.instanceMatrix.needsUpdate = true; });
  accessNodes.forEach((n, i) => {
    const s = 0.7 + Math.min(1.4, Math.pow(n.pop / 60000, 0.35)); m4.makeScale(s, s, s).setPosition(n.pos.x, n.pos.y, NET); accMesh.setMatrixAt(i, m4);
    accMesh.setColorAt(i, col.set(n.remote ? '#e3a6ff' : '#9cc8ff'));
  });
  accMesh.userData.instNodes = accessNodes; gAccess.add(accMesh); pickables.push(accMesh);
}

/* ============================================================
   LABELS
   ============================================================ */
const labelObjs = [];
const CLSOFF = { "PTCL CLS · Hawke's Bay": [-90, 16], 'PTCL CLS · Sea View / Clifton': [70, 14], "TWA CLS · Hawke's Bay (Keamari)": [-80, -14], 'Cybernet CLS (PEACE) · approx.': [0, 30], 'Gwadar CLS (planned)': [-30, 22] };
const COREOFF = { Rawalpindi: [34, 16], Islamabad: [6, -12], Faisalabad: [-34, 2], Lahore: [22, -4], Peshawar: [-24, 0] };
function label(text, pos, cls, minD = 0, maxD = 999, off = null) {
  const d = document.createElement('div'); d.className = 'lbl ' + cls; d.innerHTML = off ? `<span style="position:relative;left:${off[0]}px;top:${off[1]}px">${text}</span>` : text;
  const o = new CSS2DObject(d); o.position.copy(pos); o.userData = { minD, maxD }; gLabels.add(o); labelObjs.push(o); return o;
}
for (const n of nodes) {
  if (n.tier === 'core') label(n.name, n.pos.clone().setZ(NET + 0.28), 'core', 0, 999, COREOFF[n.name] || null);
  else if (n.tier === 'agg' && !/MW relay/.test(n.name)) label(n.name, n.pos.clone().setZ(NET + 0.12), 'agg', 0, 17);
  else if (n.tier === 'cls') label((n.planned ? '◇ ' : '') + n.name, n.pos.clone().setZ(NET + 0.1), 'cls' + (n.planned ? ' planned' : ''), 0, n.planned ? 30 : 3.2, CLSOFF[n.name] || null);
  else if (n.tier === 'ixp') label(n.name, n.pos.clone().setZ(NET + 0.12), 'ixp', 0, 4.5);
  else if (n.tier === 'dc') label(n.name, n.pos.clone().setZ(NET + 0.1), 'dc', 0, 3.2);
  else if (n.tier === 'intl') label('→ ' + n.name, n.pos.clone().setZ(0.35), 'intl', 0, 999);
  else if (n.tier === 'sat') label('🛰 ' + n.name, n.pos.clone().setZ(n.pos.z + 0.55), 'satl', 0, 999);
  else if (n.tier === 'access' && n.pop > 120000 && !CORE.some(c => N(c).pos.distanceTo(n.pos) < 0.3)) label(n.name, n.pos.clone().setZ(NET + 0.06), 'acc', 0, 6);
}
for (const [t, lo, la] of [['SINDH', 68.6, 26.0], ['PUNJAB', 72.4, 30.9], ['BALOCHISTAN', 65.6, 28.3], ['KHYBER<br>PAKHTUNKHWA', 71.2, 34.5], ['GILGIT-BALTISTAN', 75.0, 36.1], ['AJK', 73.85, 34.45]]) label(t, P(lo, la, LAND + 0.05), 'prov', 6, 999);
for (const [t, lo, la] of [['AFGHANISTAN', 66.5, 33.6], ['IRAN', 59.4, 28.4], ['INDIA', 75.6, 26.6], ['CHINA', 78.8, 37.0], ['ARABIAN SEA', 64.2, 21.4], ['GULF OF OMAN', 58.6, 24.0]]) label(t, P(lo, la, 0.05), 'country', 5, 999);
CABLES.forEach(c => { if (!c.edges[0]) return; const e = c.edges[0]; const p = e.pts[Math.floor(e.pts.length * 0.42)]; c.label = label(c.name, p.clone().setZ(0.1), 'cab', 0, 18); c.label.element.style.setProperty('--c', CAB_COL[c.id]); });
label('Pak-China OFC (SCO) · 820 km', N('Chilas').pos.clone().add(new THREE.Vector3(-0.55, 0.05, 0.2)), 'note', 0, 14);
label('26 microwave relays (backup)', towers[12].pos.clone().add(new THREE.Vector3(0.6, -0.1, 0.2)), 'note mwn', 0, 14);
label('Aerial fibre → Khunjerab', N('Sost').pos.clone().add(new THREE.Vector3(0.45, -0.05, 0.15)), 'note xbn', 0, 14);
label('CPEC Phase-II fibre (planned)', P(66.4, 30.6, NET + 0.2), 'note pln', 0, 22);

/* ============================================================
   ROUTING ENGINE (Dijkstra) — used for visual paths
   ============================================================ */
const TYPEW = { fiber: 1, metro: 0.3, subsea: 1, access: 1.1, mwaccess: 1.3, microwave: 1.7, aerial: 1.2, xborder: 1.2, sat: 60, planned: 1.15 };
let plannedActive = false;
function usable(e, ignoreCut) {
  if (e.type === 'planned' && !plannedActive) return false;
  if (e.cable && (e.cable.status !== 'live' && !e.cable.forceLive)) return false;
  if (e.cut && !ignoreCut?.has(e.id)) return false; return true;
}
class Heap { constructor() { this.a = []; } push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break;[a[p], a[i]] = [a[i], a[p]]; i = p; } } pop() { const a = this.a; const t = a[0], l = a.pop(); if (a.length) { a[0] = l; let i = 0; for (;;) { let s = i; const L = 2 * i + 1, Rr = L + 1; if (L < a.length && a[L][0] < a[s][0]) s = L; if (Rr < a.length && a[Rr][0] < a[s][0]) s = Rr; if (s === i) break;[a[s], a[i]] = [a[i], a[s]]; i = s; } } return t; } get size() { return this.a.length; } }
function dijkstra(src, dst, opt = {}) {
  const dist = new Map([[src, 0]]), prev = new Map(), order = []; const h = new Heap(); h.push([0, src]); const done = new Set();
  const metric = opt.metric || 'latency';
  while (h.size) {
    const [d, u] = h.pop(); if (done.has(u)) continue; done.add(u); order.push(u); if (u === dst) break;
    for (const e of adj.get(u)) {
      if (!usable(e, opt.ignoreCut)) continue; const v = e.a === u ? e.b : e.a; if (done.has(v)) continue;
      if (nodes[v].tier === 'intl' && v !== dst) continue; if (nodes[v].tier === 'sat' && !opt.allowSat && nodes[dst].tier !== 'sat') { /* allowed but expensive */ }
      const w = metric === 'hops' ? 1 : metric === 'cost' ? (e.type === 'subsea' ? 3 : e.type === 'sat' ? 40 : 1) * (1 + e.len) : e.len * (TYPEW[e.type] || 1) + 0.02;
      const nd = d + w; if (nd < (dist.get(v) ?? 1e18)) { dist.set(v, nd); prev.set(v, e); h.push([nd, v]); }
    }
  }
  if (!dist.has(dst)) return null;
  const pe = []; let cur = dst; while (cur !== src) { const e = prev.get(cur); pe.push(e); cur = e.a === cur ? e.b : e.a; }
  pe.reverse(); return { edges: pe, cost: dist.get(dst), order };
}
function nodeSeq(src, pe) { const s = [src]; let cur = src; for (const e of pe) { cur = e.a === cur ? e.b : e.a; s.push(cur); } return s; }
function buildPath(src, pe) {
  const pts = []; let cur = src;
  for (const e of pe) { const fw = e.a === cur; const ep = fw ? e.pts : [...e.pts].reverse(); for (let i = pts.length ? 1 : 0; i < ep.length; i++) pts.push(ep[i]); cur = fw ? e.b : e.a; }
  const arr = new Float32Array(pts.length * 3), cum = new Float32Array(pts.length); let L = 0;
  pts.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z + 0.015; if (i) L += p.distanceTo(pts[i - 1]); cum[i] = L; });
  const edgeStarts = []; { let acc = 0; for (const e of pe) { edgeStarts.push([acc, e]); acc += e.len; } }
  return { arr, cum, total: L, edges: pe, edgeStarts, n: pts.length };
}
let epoch = 0; const cache = new Map();
function route(src, dst, stale = false) {
  const k = src + '|' + dst + '|' + (stale ? 's' : epoch); if (cache.has(k)) return cache.get(k);
  const r = dijkstra(src, dst, stale ? { ignoreCut: staleSet } : {}); const p = r ? buildPath(src, r.edges) : null;
  if (cache.size > 6000) cache.clear(); cache.set(k, p); return p;
}
function concatPaths(a, b) { if (!a) return b; if (!b) return a; const arr = new Float32Array((a.n + b.n - 1) * 3); arr.set(a.arr); arr.set(b.arr.subarray(3), a.n * 3); const cum = new Float32Array(a.n + b.n - 1); cum.set(a.cum); for (let i = 1; i < b.n; i++) cum[a.n - 1 + i] = a.total + b.cum[i]; return { arr, cum, total: a.total + b.total, edges: [...a.edges, ...b.edges], edgeStarts: [...a.edgeStarts, ...b.edgeStarts.map(([d, e]) => [d + a.total, e])], n: a.n + b.n - 1 }; }
function reversePath(p) { const n = p.n, arr = new Float32Array(n * 3), cum = new Float32Array(n); for (let i = 0; i < n; i++) { arr.set(p.arr.subarray((n - 1 - i) * 3, (n - i) * 3), i * 3); cum[i] = p.total - p.cum[n - 1 - i]; } const es = []; let acc = 0; for (const e of [...p.edges].reverse()) { es.push([acc, e]); acc += e.len; } return { arr, cum, total: p.total, edges: [...p.edges].reverse(), edgeStarts: es, n }; }

/* ============================================================
   PACKETS
   ============================================================ */
const MAXP = 2600, TRAIL = 3;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(MAXP * TRAIL * 3), pCol = new Float32Array(MAXP * TRAIL * 3), pSize = new Float32Array(MAXP * TRAIL), pAlpha = new Float32Array(MAXP * TRAIL);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3));
pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1)); pGeo.setAttribute('aAlpha', new THREE.BufferAttribute(pAlpha, 1));
const pMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPR: { value: renderer.getPixelRatio() } },
  vertexShader: `attribute float aSize; attribute vec3 aColor; attribute float aAlpha; uniform float uPR; varying vec3 vC; varying float vA;
  void main(){ vC=aColor; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=clamp(aSize*uPR*(420./-mv.z),1.5,56.); gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vC; varying float vA; void main(){ float r=length(gl_PointCoord-.5)*2.; if(r>1.) discard; float a=pow(1.-r,1.8); gl_FragColor=vec4(vC*(1.+1.5*pow(1.-r,4.)),a*vA); }` });
const pPoints = new THREE.Points(pGeo, pMat); pPoints.frustumCulled = false; gPackets.add(pPoints);
const packets = []; // {path, d, v, col:Color, cat, size, dropAt}
const tmpC = new THREE.Color();
function samplePath(p, d, out) {
  if (d <= 0) { out[0] = p.arr[0]; out[1] = p.arr[1]; out[2] = p.arr[2]; return; }
  if (d >= p.total) { const i = (p.n - 1) * 3; out[0] = p.arr[i]; out[1] = p.arr[i + 1]; out[2] = p.arr[i + 2]; return; }
  let lo = 0, hi = p.n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p.cum[m] < d) lo = m; else hi = m; }
  const t = (d - p.cum[lo]) / Math.max(1e-6, p.cum[hi] - p.cum[lo]); const a = lo * 3, b = hi * 3;
  out[0] = p.arr[a] + (p.arr[b] - p.arr[a]) * t; out[1] = p.arr[a + 1] + (p.arr[b + 1] - p.arr[a + 1]) * t; out[2] = p.arr[a + 2] + (p.arr[b + 2] - p.arr[a + 2]) * t;
}
const stats = { spawned: 0, dropped: 0, delivered: 0, cat: {}, latSum: 0, latN: 0, cableLoad: {} };
function emit(path, cat, opt = {}) {
  if (!path || packets.length >= MAXP) return null;
  let dropAt = null;
  for (const [d, e] of path.edgeStarts) if (e.cut) { dropAt = d + e.len * 0.5; break; }
  const pk = { path, d: 0, v: (opt.speed || 2.6) * (0.85 + Math.random() * 0.3), col: new THREE.Color(opt.color || FLOW[cat].c), cat, size: opt.size || (cat === 'atk' ? 0.16 : 0.085), dropAt, sink: opt.sink, onArrive: opt.onArrive };
  packets.push(pk); stats.spawned++; winSp++; stats.cat[cat] = (stats.cat[cat] || 0) + 1;
  const ms = path.total * KM_PER_UNIT * 1.35 * 0.005 + path.edges.length * 0.06; stats.latSum += ms; stats.latN++;
  for (const [, e] of path.edgeStarts) { e.load += 1; if (e.cable) stats.cableLoad[e.cable.id] = (stats.cableLoad[e.cable.id] || 0) + 1; }
  return pk;
}
// weighted pickers
const srcPool = nodes.filter(n => n.kind === 'city' && n.tier !== 'tower' && n.name !== 'Khunjerab Pass');
const srcW = srcPool.map(n => Math.pow(Math.max(n.pop, 15000), 0.78)); const srcTot = srcW.reduce((a, b) => a + b, 0);
function pickCity() { let r = Math.random() * srcTot; for (let i = 0; i < srcPool.length; i++) { r -= srcW[i]; if (r <= 0) return srcPool[i]; } return srcPool[0]; }
function liveCables() { return CABLES.filter(c => (c.status === 'live' || c.forceLive) && c.edges.some(e => !e.cut)); }
function pickCableEdge() {
  const live = []; for (const c of liveCables()) for (const e of c.edges) if (!e.cut) live.push([e, c.share * (e.dir === 'W' ? 1.6 : e.dir === 'E' ? 0.9 : 0.8)]);
  if (plannedActive) live.push([plannedEdges[0], 0.12]);
  if (!live.length) return null; const tot = live.reduce((a, b) => a + b[1], 0); let r = Math.random() * tot; for (const [e, w] of live) { r -= w; if (r <= 0) return e; } return live[0][0];
}
let staleSet = new Set(), convergeUntil = 0, convergeStart = 0;
function spawnNormal() {
  const r = Math.random();
  const stale = performance.now() < convergeUntil && Math.random() < 0.55 * (convergeUntil - performance.now()) / (convergeUntil - convergeStart);
  if (r < 0.6) {
    const src = pickCity(); let ce = pickCableEdge();
    if (!ce || stale) { // stale tables keep sending into a cut cable
      if (stale && staleSet.size) { const cutC = edges[[...staleSet][Math.floor(Math.random() * staleSet.size)]]; if (cutC.cable) ce = cutC; }
      if (!ce) { // no cable → fall back to China OFC / satellite
        const p = route(src.id, INTL.N.id); if (p) emit(Math.random() < 0.5 ? p : reversePath(p), 'cn'); return;
      }
    }
    const clsId = ce.a; const p1 = route(src.id, clsId, stale); if (!p1) return;
    const p2 = buildPath(clsId, [ce]); const full = concatPaths(p1, p2);
    if (Math.random() < 0.62) emit(reversePath(full), 'in'); else emit(full, 'out');
  } else if (r < 0.74) {
    const a = pickCity(), b = pickCity(); if (a === b) return; const p = route(a.id, b.id, stale); emit(p, 'dom');
  } else if (r < 0.86) {
    const a = pickCity(); let best = null, bd = 1e9; for (const d of DCS) { const dd = d.pos.distanceTo(a.pos); if (dd < bd) { bd = dd; best = d; } }
    const p = route(a.id, best.id); if (p) emit(reversePath(p), 'cdn');
  } else if (r < 0.92) {
    const v = VSAT[Math.floor(Math.random() * VSAT.length)]; const g = GW[Math.floor(Math.random() * GW.length)];
    const se1 = adj.get(v.id).find(e => e.type === 'sat'), se2 = adj.get(g.id).find(e => e.type === 'sat');
    const p = buildPath(v.id, [se1, se2]); emit(Math.random() < 0.5 ? p : reversePath(p), 'sat', { speed: 4.5 });
  } else if (r < 0.97) {
    const src = [N('Islamabad'), N('Rawalpindi'), N('Lahore'), N('Gilgit'), N('Peshawar')][Math.floor(Math.random() * 5)];
    const p = route(src.id, INTL.N.id); if (p) emit(Math.random() < 0.5 ? p : reversePath(p), 'cn');
  } else {
    const pairs = [[N('Peshawar'), INTL.AF], [N('Quetta'), INTL.AFS], [N('Quetta'), INTL.IR]]; const [a, b] = pairs[Math.floor(Math.random() * 3)];
    const p = route(a.id, b.id); if (p) emit(Math.random() < 0.5 ? p : reversePath(p), 'xb');
  }
}

/* ============================================================
   FX (bursts, highlight paths)
   ============================================================ */
const bursts = [];
const burstGeo = new THREE.RingGeometry(0.6, 1, 40);
function burst(pos, color = COL.attack, s = 0.25, life = 0.8) {
  const m = new THREE.Mesh(burstGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.copy(pos); gFX.add(m); bursts.push({ m, t: 0, life, s }); if (bursts.length > 140) { const b = bursts.shift(); gFX.remove(b.m); b.m.material.dispose(); }
}
let hiLines = [];
function clearHighlight() { hiLines.forEach(l => gFX.remove(l)); hiLines = []; }
function highlightPath(src, pe, color = '#ffe66b') {
  clearHighlight();
  const p = buildPath(src, pe); const pts = []; for (let i = 0; i < p.n; i++) pts.push(new THREE.Vector3(p.arr[i * 3], p.arr[i * 3 + 1], p.arr[i * 3 + 2] + 0.02));
  const l1 = fatLine(pts, { color, linewidth: 4.5, opacity: 0.95, dashed: true, dashSize: 0.14, gapSize: 0.06 });
  const l2 = fatLine(pts, { color, linewidth: 14, opacity: 0.18 });
  gFX.add(l2, l1); hiLines.push(l1, l2); l1.userData.anim = true; return p;
}
const cutMarks = new Map();
function markCut(e) {
  const mid = e.pts[Math.floor(e.pts.length * (e.cable ? 0.3 : 0.5))];
  const g = new THREE.Group(); const red = fatLine(e.pts, { color: COL.attack, linewidth: 3, opacity: 0.9, dashed: true, dashSize: 0.05, gapSize: 0.05 });
  const x = new THREE.Group(); const xm = new THREE.MeshBasicMaterial({ color: 0xff3355 });
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.02), xm); b1.rotation.z = 0.78; const b2 = b1.clone(); b2.rotation.z = -0.78; x.add(b1, b2, glowSprite(0xff3355, 0.6)); x.position.copy(mid).setZ(mid.z + 0.06);
  g.add(red, x); gFX.add(g); cutMarks.set(e.id, g); e.cutPos = mid;
}
function unmarkCut(e) { const g = cutMarks.get(e.id); if (g) { gFX.remove(g); cutMarks.delete(e.id); } }

/* ============================================================
   SIM STATE / ACTIONS
   ============================================================ */
const ui = (id) => document.getElementById(id);
let simHour = 21.0, speed = 1, playing = true, spawnAcc = 0;
const series = { thr: [], lat: [], loss: [], conv: [] };
let lastConv = 0, convAlgo = 'OSPF';
function log(msg, kind = '') {
  const t = fmtClock(simHour); const el = document.createElement('div'); el.className = 'ev ' + kind; el.innerHTML = `<span>${t}</span>${msg}`;
  const f = ui('evlog'); f.prepend(el); while (f.children.length > 40) f.lastChild.remove();
  ui('ticker').innerHTML = `<span class="dot ${kind}"></span>${msg}`;
}
function fmtClock(h) { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }
function diurnal(h) { h = ((h % 24) + 24) % 24; if (h >= 5 && h <= 22) return 0.3 + 0.7 * (1 - Math.cos(Math.PI * (h - 5) / 17)) / 2; const t = ((h - 22 + 24) % 24) / 7; return 0.3 + 0.7 * (1 + Math.cos(Math.PI * t)) / 2; }

function topologyChanged(cutEdges, algo = 'OSPF') {
  epoch++; cache.clear();
  // packets already riding into a cut edge get dropped there
  for (const pk of packets) if (!pk.dropAt) for (const [d, e] of pk.path.edgeStarts) if (e.cut && d + e.len * 0.5 > pk.d) { pk.dropAt = d + e.len * 0.5; break; }
  if (cutEdges && cutEdges.length) {
    staleSet = new Set(cutEdges.map(e => e.id)); convergeStart = performance.now();
    const T = algo === 'BGP' ? 6500 : algo === 'RIP' ? 9000 : 2600; convergeUntil = convergeStart + T; convAlgo = algo;
    const shown = algo === 'BGP' ? (30 + Math.random() * 25) : algo === 'RIP' ? (90 + Math.random() * 60) : (0.6 + Math.random() * 1.6);
    lastConv = shown; showToast(algo, shown, T);
  }
  updateCableList(); updateKPIs();
}
function cutEdge(e, algo) { if (e.cut) return; e.cut = true; markCut(e); burst(e.cutPos.clone(), COL.attack, 0.6, 1.2); }
function restoreEdge(e) { if (!e.cut) return; e.cut = false; unmarkCut(e); }
function cutCable(c, on = true, algo = 'BGP') {
  if (on) { c.edges.forEach(e => cutEdge(e)); log(`<b>${c.name}</b> cut — traffic shifting to remaining cables`, 'bad'); topologyChanged(c.edges, algo); }
  else { c.edges.forEach(restoreEdge); log(`<b>${c.name}</b> restored`, 'good'); topologyChanged([], algo); }
}
function restoreAll() { edges.forEach(e => { if (e.cut) restoreEdge(e); }); staleSet = new Set(); convergeUntil = 0; log('All links restored', 'good'); topologyChanged([]); }

/* ---------- toast ---------- */
let toastTimer = null;
function showToast(algo, shown, T) {
  const t = ui('toast'); t.classList.add('on');
  ui('toastTxt').innerHTML = `⟳ Reconverging · <b>${algo}</b>`; ui('toastBar').style.transition = 'none'; ui('toastBar').style.width = '0%';
  requestAnimationFrame(() => { ui('toastBar').style.transition = `width ${T}ms linear`; ui('toastBar').style.width = '100%'; });
  let s = performance.now(); clearInterval(toastTimer);
  toastTimer = setInterval(() => { const f = Math.min(1, (performance.now() - s) / T); ui('toastVal').textContent = (shown * f).toFixed(shown < 5 ? 2 : 1) + ' s'; if (f >= 1) { clearInterval(toastTimer); ui('toastTxt').innerHTML = `✓ Converged · <b>${algo}</b>`; setTimeout(() => t.classList.remove('on'), 1800); log(`${algo} converged in <b>${shown.toFixed(shown < 5 ? 2 : 1)} s</b> (simulated)`, 'good'); } }, 50);
}

/* ============================================================
   SECURITY SCENARIOS (mock, scripted)
   ============================================================ */
let defense = true; const scen = { hijack: null, ddos: null, mal: null };
const timers = [];
function later(ms, fn) { const t = setTimeout(fn, ms); timers.push(t); return t; }
function alertFeed(html, kind) { const el = document.createElement('div'); el.className = 'alert ' + kind; el.innerHTML = html; ui('alerts').prepend(el); while (ui('alerts').children.length > 12) ui('alerts').lastChild.remove(); log(html.replace(/<br>.*/, ''), kind === 'crit' ? 'bad' : kind === 'ok' ? 'good' : 'warn'); }
function shieldAt(node, color = 0x4dffb5, r = 0.45) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = Math.PI / 2; m.position.copy(node.pos).setZ(LAND); const w = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.25 }));
  w.rotation.x = Math.PI / 2; w.position.copy(m.position); gFX.add(m, w); return [m, w];
}
function runHijack() {
  stopScenarios(); setTab('security');
  const ptcl = N('Karachi'); scen.hijack = { phase: 1, t0: performance.now() };
  alertFeed('<b>Scenario:</b> replay of 24 Feb 2008 — AS17557 (PTCL) originates <code>208.65.153.0/24</code> to block YouTube domestically', 'info');
  burst(ptcl.pos.clone().setZ(NET + 0.1), COL.attack, 0.9, 1.5);
  later(1800, () => { alertFeed('Announcement leaks to upstream <b>AS3491 (PCCW)</b> → propagates worldwide. The /24 is more specific than YouTube\'s /22, so it wins everywhere', 'crit'); scen.hijack.phase = 2; });
  later(3500, () => { scen.hijack.phase = 3; alertFeed('Global YouTube-bound traffic now flows <b>into Pakistan</b> and is black-holed', 'crit'); });
  if (defense) {
    later(5600, () => alertFeed('<b>Detector:</b> MOAS conflict + RPKI ROV = <b>INVALID</b> (ROA authorises AS36561 only)<br><small>confidence 0.97 · 14 vantage points</small>', 'warn'));
    later(7600, () => { alertFeed('<b>Adaptive response:</b> upstream filters drop the invalid route · origin AS36561 announces /25 more-specifics · hijack contained', 'ok'); scen.hijack.phase = 4; shieldAt(ptcl, 0x4dffb5, 0.7); });
    later(12500, () => { scen.hijack = null; });
  } else {
    later(7000, () => alertFeed('No defence active — historically the outage lasted ~2 hours until PCCW withdrew the route', 'crit'));
    later(14000, () => { scen.hijack = null; });
  }
}
function runDDoS() {
  stopScenarios(); setTab('security'); const dc = DCS[1]; scen.ddos = { phase: 1, target: dc, scrub: DCS[3] };
  alertFeed('<b>Scenario:</b> volumetric UDP-reflection DDoS against <b>Cloudflare edge · Lahore</b> (illustrative)', 'info');
  later(1500, () => alertFeed('Lahore core queue at <b>98%</b> · loss 12% · RTT +140 ms', 'crit'));
  if (defense) {
    later(4000, () => alertFeed('<b>Detector:</b> source-entropy spike, 40× baseline pps from 3 cable ingress points', 'warn'));
    later(6000, () => { scen.ddos.phase = 2; alertFeed('<b>Adaptive response:</b> BGP FlowSpec diverts attack traffic to scrubbing in Karachi · RTBH for top prefixes · clean traffic forwarded', 'ok'); shieldAt(dc.city, 0x4dffb5, 0.55); });
    later(14000, () => { scen.ddos = null; });
  } else later(12000, () => { scen.ddos = null; });
}
function runMalware() {
  stopScenarios(); setTab('security'); const city = N('Mardan'); scen.mal = { phase: 1, city };
  alertFeed('<b>Scenario:</b> cluster of compromised mobile devices near <b>Mardan</b> beaconing to an external C2', 'info');
  if (defense) {
    later(3000, () => alertFeed('<b>Context-aware detector:</b> abnormal periodic flows + unusual destination ASN · risk score 0.91', 'warn'));
    later(5000, () => { scen.mal.phase = 2; alertFeed('<b>Self-protecting response:</b> adaptive access policy → quarantine VLAN, step-up auth, C2 prefix blocked at edge', 'ok'); shieldAt(city, 0x4dffb5, 0.38); });
    later(12000, () => { scen.mal = null; });
  } else later(11000, () => { scen.mal = null; });
}
function stopScenarios() { timers.forEach(clearTimeout); timers.length = 0; scen.hijack = scen.ddos = scen.mal = null; }
function spawnScenario(dt) {
  if (scen.hijack) {
    const ph = scen.hijack.phase; const k = N('Karachi');
    if (ph === 2 && Math.random() < dt * 40) { const ce = pickCableEdge(); if (ce) emit(buildPath(ce.a, [ce]), 'atk', { speed: 3.5 }); }
    if (ph === 3 && Math.random() < dt * 90) { const ce = pickCableEdge(); if (ce) { const p = reversePath(concatPaths(route(k.id, ce.a), buildPath(ce.a, [ce]))); const pk = emit(p, 'atk', { speed: 3 }); if (pk) pk.sink = true; } }
  }
  if (scen.ddos) {
    const tgt = scen.ddos.target, scrub = scen.ddos.scrub;
    if (Math.random() < dt * 110) {
      const ce = pickCableEdge(); if (ce) {
        const toNode = scen.ddos.phase === 2 ? scrub.id : tgt.id;
        const p = reversePath(concatPaths(route(toNode, ce.a), buildPath(ce.a, [ce]))); const pk = emit(p, 'atk', { speed: 3 }); if (pk) pk.sink = true;
      }
    }
    if (Math.random() < dt * 20) { const a = pickCity(); const p = route(a.id, (scen.ddos.phase === 2 ? scen.ddos.scrub : tgt).id); if (p) { const pk = emit(p, 'atk'); if (pk) pk.sink = true; } }
  }
  if (scen.mal) {
    const c = scen.mal.city;
    if (scen.mal.phase === 1 && Math.random() < dt * 30) { const ce = pickCableEdge(); if (ce) { const p = concatPaths(route(c.id, ce.a), buildPath(ce.a, [ce])); emit(p, 'atk', { color: '#ff4dd8' }); } }
    if (scen.mal.phase === 2 && Math.random() < dt * 12) { const p = route(c.id, N('Peshawar').id); if (p) { const pk = emit(p, 'atk', { color: '#ff4dd8' }); if (pk) pk.dropAt = 0.12; } }
  }
}

/* ============================================================
   ROUTING DEMOS
   ============================================================ */
const routeNodes = nodes.filter(n => (n.kind === 'city' && (n.tier === 'core' || n.tier === 'agg') && !/Pass|relay/.test(n.name)) || n.tier === 'intl' || n.tier === 'cls' && !n.planned || n.tier === 'dc' || n.tier === 'ixp').sort((a, b) => (a.tier === 'intl') - (b.tier === 'intl') || a.name.localeCompare(b.name));
let algo = 'dijkstra', metric = 'latency';
function traceRoute() {
  const s = +ui('rsrc').value, d = +ui('rdst').value; if (s === d) return;
  const res = dijkstra(s, d, { metric }); if (!res) { ui('hops').innerHTML = '<div class="muted">No path — destination unreachable (all links cut?)</div>'; return; }
  const p = highlightPath(s, res.edges, algo === 'bgp' ? '#ff9cf2' : algo === 'bf' ? '#ffb347' : '#ffe66b');
  for (let i = 0; i < 6; i++) setTimeout(() => emit(p, 'dom', { color: '#fff1a8', size: 0.14, speed: 2 }), i * 220);
  // animate algorithm exploration
  if (algo === 'dijkstra') res.order.slice(0, 140).forEach((id, i) => setTimeout(() => nodes[id].pos && burst(nodes[id].pos.clone().setZ(NET + 0.02), '#ffe66b', 0.12, 0.6), i * 18));
  else if (algo === 'bf') { // relaxation waves by hop count
    const hopsFrom = new Map([[d, 0]]); let frontier = [d];
    for (let k = 1; k < 9 && frontier.length; k++) { const nf = []; for (const u of frontier) for (const e of adj.get(u)) { if (!usable(e)) continue; const v = e.a === u ? e.b : e.a; if (!hopsFrom.has(v) && nodes[v].tier !== 'access') { hopsFrom.set(v, k); nf.push(v); } } frontier = nf; nf.forEach(v => setTimeout(() => burst(nodes[v].pos.clone().setZ(NET + 0.02), '#ffb347', 0.16, 0.7), k * 380)); }
  }
  const seq = nodeSeq(s, res.edges); let ms = 0; let rows = '';
  const asOf = (e) => e ? (e.cable ? e.cable.op : e.ops[0] || 'local') : '';
  seq.forEach((id, i) => {
    const n = nodes[id]; const e = res.edges[i - 1]; if (e) ms += e.len * KM_PER_UNIT * 1.35 * 0.005 + 0.06;
    rows += `<tr><td>${i}</td><td>${n.name}<small>${tierName(n)}${e ? ' · ' + mediumName(e) : ''}</small></td><td>${algo === 'bgp' ? (asOf(e) || '—') : (e ? (e.cable ? e.cable.name : e.ops[0] || '—') : '—')}</td><td>${(ms * 2).toFixed(1)}</td></tr>`;
  });
  ui('hops').innerHTML = `<table><thead><tr><th>#</th><th>Hop</th><th>${algo === 'bgp' ? 'AS' : 'Carrier'}</th><th>RTT ms</th></tr></thead><tbody>${rows}</tbody></table>`;
  if (algo === 'bgp') {
    const path = []; res.edges.forEach(e => { const a = asOf(e); if (a && a !== 'local' && path[path.length - 1] !== a) path.push(a); });
    ui('aspath').innerHTML = `AS-PATH: ${path.map(a => `<span class="as" style="--c:${OPS[a] || '#ccc'}">${a === 'PTCL' ? 'AS17557 PTCL' : a}</span>`).join('<i>›</i>')} <small>(policy: customer &gt; peer &gt; provider, then shortest AS-path)</small>`;
  } else ui('aspath').innerHTML = '';
  ui('rsum').innerHTML = `<b>${seq.length - 1}</b> hops · <b>${(ms * 2).toFixed(1)} ms</b> RTT (est.) · ${res.order.length} nodes explored`;
  log(`Traceroute ${nodes[s].name} → ${nodes[d].name}: ${seq.length - 1} hops, ${(ms * 2).toFixed(1)} ms`, '');
}
function tierName(n) { return { core: 'core router', agg: 'aggregation router', access: 'access node', cls: 'cable landing station', ixp: 'internet exchange', dc: 'data centre / CDN', intl: 'international PoP', sat: 'satellite', gw: 'teleport', vsat: 'VSAT terminal', tower: 'microwave relay' }[n.tier] || n.tier; }
function mediumName(e) { return { fiber: 'DWDM fibre', metro: 'metro fibre', subsea: 'submarine fibre', access: 'last-mile', mwaccess: 'microwave last-mile', microwave: 'microwave', aerial: 'aerial fibre', xborder: 'cross-border fibre', sat: 'Ka-band satellite', planned: 'planned fibre' }[e.type] || e.type; }
let loopTimer = null;
function countToInfinity() {
  setTab('routing'); const A = N('Sibi'), B = N('Jacobabad'), X = N('Quetta');
  const e = adj.get(A.id).find(e => (e.a === X.id || e.b === X.id)); if (!e) return;
  cutEdge(e); topologyChanged([e], 'RIP');
  log('RIP demo: link Quetta–Sibi fails; Sibi and Jacobabad keep advertising stale routes to each other', 'warn');
  const tb = ui('cti'); tb.innerHTML = ''; let k = 0;
  const p1 = buildPath(A.id, [adj.get(A.id).find(x => x.a === B.id || x.b === B.id)]); const p2 = reversePath(p1);
  clearInterval(loopTimer);
  loopTimer = setInterval(() => {
    k++; const da = 1 + 2 * k, db = 2 + 2 * k;
    tb.innerHTML = `<div class="ctir"><span>iteration ${k}</span><span>Sibi → Quetta: <b>${da >= 16 ? '∞' : da}</b> via Jacobabad</span><span>Jacobabad → Quetta: <b>${db >= 16 ? '∞' : db}</b> via Sibi</span></div>` + tb.innerHTML;
    emit(k % 2 ? p1 : p2, 'loop', { speed: 1.6, size: 0.13 }); emit(k % 2 ? p2 : p1, 'loop', { speed: 1.6, size: 0.13 });
    if (da >= 16) { clearInterval(loopTimer); tb.innerHTML = `<div class="ctir done">Metric hit 16 = ∞ → route withdrawn. Fixes: split horizon, poison reverse, hold-down timers.</div>` + tb.innerHTML; log('RIP: count-to-infinity resolved at metric 16', 'good'); }
  }, 650);
}

/* ============================================================
   UI WIRING
   ============================================================ */
function setTab(t) { document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + t)); }
document.querySelectorAll('.tab').forEach(b => b.onclick = () => setTab(b.dataset.tab));
const LAYER_UI = [
  ['cables', 'Submarine cables', '#00e5ff', 'line'], ['backbone', 'Fibre backbone (by operator)', '#2f9bff', 'bundle'], ['microwave', 'Microwave links & relays', '#ff7de9', 'dash'],
  ['satellite', 'Satellite · PakSat-MM1', '#ff9cf2', 'sat'], ['xborder', 'China OFC & cross-border', '#a6ff6b', 'dash'], ['planned', 'Planned · Gwadar / CPEC-II', '#ffb347', 'dash'],
  ['access', 'Access · all cities & metro', '#9cc8ff', 'dot'], ['routers', 'Core & aggregation routers', '#7af3ff', 'hex'], ['ixp', 'IXPs & data centres', '#ffd166', 'dia'],
  ['packets', 'Packets', '#5cf2ff', 'pk'], ['heat', 'Link utilisation heatmap', '#ff6b3d', 'heat'], ['lights', 'Population density', '#ffc46b', 'dot'], ['prov', 'Provinces & Indus', '#4cc9ff', 'dash'], ['labels', 'Labels', '#cfe8ff', 'txt']
];
function glyph(k, c) {
  const s = { line: `<line x1="2" y1="8" x2="22" y2="8" stroke="${c}" stroke-width="2.5"/>`, bundle: `<line x1="2" y1="5" x2="22" y2="5" stroke="#2f9bff" stroke-width="1.6"/><line x1="2" y1="8" x2="22" y2="8" stroke="#00e0b0" stroke-width="1.6"/><line x1="2" y1="11" x2="22" y2="11" stroke="#c77dff" stroke-width="1.6"/>`,
    dash: `<line x1="2" y1="8" x2="22" y2="8" stroke="${c}" stroke-width="2" stroke-dasharray="3 2"/>`, sat: `<rect x="9" y="5" width="6" height="6" fill="${c}"/><rect x="1" y="6.5" width="7" height="3" fill="#3b6cff"/><rect x="16" y="6.5" width="7" height="3" fill="#3b6cff"/>`,
    dot: `<circle cx="7" cy="8" r="2" fill="${c}"/><circle cx="14" cy="6" r="1.5" fill="${c}"/><circle cx="18" cy="11" r="1.8" fill="${c}"/>`, hex: `<polygon points="12,2 18,5 18,11 12,14 6,11 6,5" fill="${c}"/>`, dia: `<polygon points="12,2 18,8 12,14 6,8" fill="${c}"/>`,
    pk: `<circle cx="16" cy="8" r="3.5" fill="${c}"/><circle cx="9" cy="8" r="2.2" fill="${c}" opacity=".5"/><circle cx="4" cy="8" r="1.4" fill="${c}" opacity=".25"/>`, heat: `<defs><linearGradient id="hg"><stop offset="0" stop-color="#4dffb5"/><stop offset=".5" stop-color="#ffd166"/><stop offset="1" stop-color="#ff3355"/></linearGradient></defs><rect x="2" y="6" width="20" height="4" rx="2" fill="url(#hg)"/>`,
    txt: `<text x="12" y="12" font-size="10" text-anchor="middle" fill="${c}" font-family="sans-serif">Aa</text>` }[k];
  return `<svg width="24" height="16" viewBox="0 0 24 16">${s}</svg>`;
}
ui('layers').innerHTML = LAYER_UI.map(([k, t, c, g]) => `<label class="lay"><input type="checkbox" data-k="${k}" ${k === 'heat' ? '' : 'checked'}><span class="sw"></span>${glyph(g, c)}<span class="lt">${t}</span></label>`).join('');
ui('layers').querySelectorAll('input').forEach(i => i.onchange = () => { const k = i.dataset.k; layers[k].visible = i.checked; if (k === 'labels') labelRenderer.domElement.style.display = i.checked ? '' : 'none'; if (k === 'prov') landMat.uniforms.uDim.value = i.checked ? 1 : 0.85; });
ui('ops').innerHTML = Object.entries(OPS).map(([k, c]) => `<span class="op" style="--c:${c}">${k}</span>`).join('') + `<span class="op" style="--c:#ff9cf2">PakSat</span>`;
// routing selects
const opt = routeNodes.map(n => `<option value="${n.id}">${n.tier === 'intl' ? '🌐 ' : n.tier === 'cls' ? '⚓ ' : n.tier === 'dc' ? '🗄 ' : n.tier === 'ixp' ? '◆ ' : ''}${n.name}</option>`).join('');
ui('rsrc').innerHTML = opt; ui('rdst').innerHTML = opt; ui('rsrc').value = N('Gilgit').id; ui('rdst').value = INTL.W.id;
document.querySelectorAll('#algos button').forEach(b => b.onclick = () => { algo = b.dataset.a; document.querySelectorAll('#algos button').forEach(x => x.classList.toggle('on', x === b)); document.querySelectorAll('.algoinfo').forEach(x => x.style.display = x.dataset.a === algo ? '' : 'none'); ui('ctiwrap').style.display = algo === 'bf' ? '' : 'none'; });
ui('rmetric').onchange = e => metric = e.target.value;
ui('btnTrace').onclick = traceRoute; ui('btnClear').onclick = () => { clearHighlight(); ui('hops').innerHTML = ''; ui('aspath').innerHTML = ''; ui('rsum').innerHTML = ''; };
ui('btnCTI').onclick = countToInfinity;
// failures
function updateCableList() {
  ui('cablelist').innerHTML = CABLES.map(c => {
    const cut = c.edges.length && c.edges.every(e => e.cut); const st = c.status === 'retired' ? 'Retired' : c.status === 'landed' ? (c.forceLive ? 'Live (sim)' : 'Landed · activation pending') : cut ? 'CUT' : 'Live';
    return `<div class="cab ${cut ? 'cut' : ''} ${c.status}"><i style="--c:${CAB_COL[c.id]}"></i><div><b>${c.name}</b><small>${c.op} · ${c.dirs.map(d => ({ W: 'west', E: 'east', SW: 'Africa' }[d])).join(' + ')} · <em>${st}</em></small></div>${c.status === 'retired' ? '' : c.status === 'landed' ? `<button class="mini" data-act="${c.id}">${c.forceLive ? 'Deactivate' : 'Activate'}</button>` : `<button class="mini ${cut ? 'g' : 'r'}" data-cut="${c.id}">${cut ? 'Restore' : 'Cut'}</button>`}</div>`;
  }).join('');
  ui('cablelist').querySelectorAll('[data-cut]').forEach(b => b.onclick = () => { const c = CABLES.find(x => x.id === b.dataset.cut); const cut = c.edges.every(e => e.cut); cutCable(c, !cut, ui('falgo').value); });
  ui('cablelist').querySelectorAll('[data-act]').forEach(b => b.onclick = () => { const c = CABLES.find(x => x.id === b.dataset.act); c.forceLive = !c.forceLive; c.edges.forEach(e => { e.line.material.dashed = !c.forceLive; e.glow.material.opacity = c.forceLive ? 0.13 : 0.05; }); log(`${c.name} ${c.forceLive ? 'activated (simulated)' : 'deactivated'}`, c.forceLive ? 'good' : ''); topologyChanged([]); });
}
const SCEN = {
  aae1: () => { const c = CABLES.find(c => c.id === 'AAE1'); cutCable(c, true, 'BGP'); log('Replay: AAE-1 fault near Qatar (2 Jan 2025) — PTCL shifts load to SMW4 & IMEWE', 'bad'); flyTo('karachi'); },
  oct25: () => { cutCable(CABLES.find(c => c.id === 'PEACE'), true, 'BGP'); cutCable(CABLES.find(c => c.id === 'IMEWE'), true, 'BGP'); log('Replay: Oct 2025 — PEACE cut between Red Sea & Europe while IMEWE down', 'bad'); },
  karachi: () => { CABLES.forEach(c => c.edges.forEach(e => { if (c.status !== 'retired') cutEdge(e); })); log('<b>Worst case:</b> Karachi landing zone lost — every submarine cable down. Only China OFC, satellite & cross-border remain', 'bad'); topologyChanged(cableEdges, 'BGP'); flyTo('overview'); },
  kkh: () => { const e = adj.get(N('Chilas').id).find(e => e.type === 'fiber' && (nodes[e.a].name === 'Gilgit' || nodes[e.b].name === 'Gilgit')); cutEdge(e); log('Landslide cuts KKH fibre Chilas–Gilgit → Gilgit-Baltistan fails over to the microwave chain', 'bad'); topologyChanged([e], 'OSPF'); flyTo('north'); },
  gwadar: () => { plannedActive = !plannedActive; CLS.gwadar.planned = !plannedActive; log(plannedActive ? 'Gwadar landing + CPEC-II fibre <b>activated</b> (what-if) — second international gateway' : 'Gwadar what-if disabled', plannedActive ? 'good' : ''); ui('btnGwadar').classList.toggle('on', plannedActive); topologyChanged([]); },
  restore: () => restoreAll()
};
document.querySelectorAll('[data-scen]').forEach(b => b.onclick = () => SCEN[b.dataset.scen]());
// security
ui('def').onchange = e => { defense = e.target.checked; ui('defTxt').textContent = defense ? 'ON — detect & adapt automatically' : 'OFF — observe the damage'; };
ui('btnHijack').onclick = runHijack; ui('btnDDoS').onclick = runDDoS; ui('btnMal').onclick = runMalware;
// playback
ui('play').onclick = () => { playing = !playing; ui('play').innerHTML = playing ? '❚❚' : '▶'; };
document.querySelectorAll('#speeds button').forEach(b => b.onclick = () => { speed = +b.dataset.s; document.querySelectorAll('#speeds button').forEach(x => x.classList.toggle('on', x === b)); });
ui('tod').oninput = e => { simHour = +e.target.value; };
{ // diurnal curve svg
  let d = ''; for (let i = 0; i <= 96; i++) { const h = i / 4; d += (i ? 'L' : 'M') + (i / 96 * 300).toFixed(1) + ',' + (30 - diurnal(h) * 26).toFixed(1); }
  ui('curve').innerHTML = `<path d="${d} L300,32 L0,32Z" fill="url(#cg)"/><path d="${d}" fill="none" stroke="#5cf2ff" stroke-width="1.2"/>`;
}
// camera presets
const VIEWS = {
  overview: { p: [0.2, -18.5, 15.5], t: [0.2, -2.2, 0] }, top: { p: [0.3, -1.2, 26], t: [0.3, -1.0, 0] },
  karachi: { p: [-2.2, -7.05, 1.05], t: [-2.02, -5.4, 0] }, north: { p: [3.9, 2.0, 3.6], t: [4.4, 5.1, 0] },
  sat: { p: [-11, -9, 9], t: [-2.5, 0.5, 1.5] }, sea: { p: [-1.5, -16, 4.5], t: [-2.3, -7.8, 0] }
};
let fly = null;
function flyTo(k, dur = 2200) { const v = VIEWS[k]; fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...v.p), t1: new THREE.Vector3(...v.t), s: performance.now(), dur }; document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === k)); }
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { tour = false; ui('btnTour').classList.remove('on'); flyTo(b.dataset.view); });
let tour = false, tourIdx = 0, tourNext = 0; const TOUR = ['overview', 'karachi', 'sea', 'north', 'sat', 'top'];
ui('btnTour').onclick = () => { tour = !tour; ui('btnTour').classList.toggle('on', tour); tourNext = 0; };
window.__flyTo = flyTo; window.__sim = { SCEN, runHijack, runDDoS, runMalware, setTab, traceRoute, countToInfinity, ui };

// hover / inspect
const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2(); let hoverNode = null, inspectNode = null;
renderer.domElement.addEventListener('pointermove', ev => { mouse.set(ev.clientX / innerWidth * 2 - 1, -ev.clientY / innerHeight * 2 + 1); hoverPending = [ev.clientX, ev.clientY]; });
let hoverPending = null, downAt = null;
renderer.domElement.addEventListener('pointerdown', ev => downAt = [ev.clientX, ev.clientY]);
renderer.domElement.addEventListener('pointerup', ev => { if (downAt && Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) < 5) { if (hoverNode) openInspector(hoverNode); else closeInspector(); } });
function pick() {
  ray.setFromCamera(mouse, camera); ray.params.Points = { threshold: 0.05 };
  const vis = pickables.filter(o => { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; });
  const hit = ray.intersectObjects(vis, true)[0];
  if (!hit) return null; if (hit.object === accMesh) return accessNodes[hit.instanceId]; return hit.object.userData.node || null;
}
function tip(n, x, y) {
  const t = ui('tip'); if (!n) { t.style.opacity = 0; return; }
  const deg = adj.get(n.id).filter(e => usable(e)).length;
  t.innerHTML = `<b>${n.name}</b><span class="tb t-${n.tier}">${tierName(n)}</span><div>${n.pop ? 'pop. ≈ ' + n.pop.toLocaleString() + ' · ' : ''}${deg} active links</div><small>click to inspect</small>`;
  t.style.opacity = 1; t.style.transform = `translate(${x + 16}px, ${y + 12}px)`;
}
function openInspector(n) {
  inspectNode = n; const el = ui('insp'); el.classList.add('on');
  const links = adj.get(n.id).slice(0, 9).map((e, i) => { const o = nodes[e.a === n.id ? e.b : e.a]; const sp = e.type === 'subsea' ? '400G' : e.type === 'fiber' ? '100G' : e.type === 'microwave' || e.type === 'mwaccess' ? '1G' : e.type === 'sat' ? '200M' : '10G'; return `<div class="if ${e.cut ? 'cut' : ''}"><code>${e.type === 'subsea' ? 'Hu' : e.type === 'sat' ? 'Sat' : 'Te'}0/0/${i}</code><span>→ ${o.name}</span><em>${sp} · ${mediumName(e)}</em><b data-e="${e.id}"></b></div>`; }).join('');
  el.innerHTML = `<button class="x" id="inspX">×</button><div class="ih"><span class="tb t-${n.tier}">${tierName(n)}</span><h3>${n.name}</h3><small>${n.lon ? n.lat.toFixed(3) + '°N, ' + n.lon.toFixed(3) + '°E' : ''} ${n.op ? '· ' + n.op : ''}</small></div>
  <div class="ig"><div><label>Queue</label><div class="bar"><i id="iq"></i></div></div><div><label>CPU</label><div class="bar"><i id="icpu"></i></div></div><div><label>Pkts/s</label><b id="ipps">—</b></div></div>
  <label class="sec">Interfaces <small>(mock)</small></label>${links || '<div class="muted">none</div>'}
  <div class="ibtns"><button class="mini" id="iSrc">Set as source</button><button class="mini" id="iDst">Set as destination</button><button class="mini r" id="iFail">Fail node</button></div>`;
  ui('inspX').onclick = closeInspector;
  ui('iSrc').onclick = () => { if (routeNodes.includes(n)) ui('rsrc').value = n.id; setTab('routing'); };
  ui('iDst').onclick = () => { if (routeNodes.includes(n)) ui('rdst').value = n.id; setTab('routing'); };
  ui('iFail').onclick = () => { const es = adj.get(n.id).filter(e => !e.cut); es.forEach(e => cutEdge(e)); log(`Node <b>${n.name}</b> failed — ${es.length} links down`, 'bad'); topologyChanged(es, 'OSPF'); openInspector(n); };
}
function closeInspector() { inspectNode = null; ui('insp').classList.remove('on'); }

/* ============================================================
   METRICS / KPIs
   ============================================================ */
function spark(id, data, color, max, fmt) {
  const cv = ui(id); if (!cv) return; const w = cv.width = cv.clientWidth * 2, h = cv.height = cv.clientHeight * 2; const x = cv.getContext('2d'); x.clearRect(0, 0, w, h);
  if (data.length < 2) return; const mx = max || Math.max(...data) * 1.15 || 1;
  x.beginPath(); data.forEach((v, i) => { const px = i / (120 - 1) * w, py = h - v / mx * (h - 6) - 3; i ? x.lineTo(px, py) : x.moveTo(px, py); });
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, color + '66'); g.addColorStop(1, color + '00');
  x.lineWidth = 2.5; x.strokeStyle = color; x.stroke(); x.lineTo((data.length - 1) / 119 * w, h); x.lineTo(0, h); x.fillStyle = g; x.fill();
  const lab = cv.parentElement.querySelector('b'); if (lab) lab.textContent = fmt(data[data.length - 1]);
}
let winSp = 0, winDr = 0;
function updateKPIs() {
  const live = liveCables(); const cap = Math.max(0.35, live.reduce((a, c) => a + c.share, 0) * 17.2 / 0.96 + (plannedActive ? 2 : 0));
  ui('kCab').textContent = `${live.length}/${CABLES.filter(c => c.status !== 'retired').length}`;
  ui('kCap').textContent = cap.toFixed(1);
  return cap;
}
setInterval(() => {
  const cap = updateKPIs(); const load = diurnal(simHour);
  const demand = 12.4 * load + (scen.ddos ? 3 : 0);
  const thr = Math.min(cap * 0.97, demand) * (0.97 + Math.random() * 0.06);
  const loss = winSp ? (winDr / winSp) * 100 : 0;
  const congestion = Math.min(4, Math.max(0, demand / Math.max(cap, 0.1) - 0.8));
  const lat = 21 + congestion * 90 + (scen.ddos && scen.ddos.phase === 1 ? 120 : 0) + Math.random() * 2;
  series.thr.push(thr); series.lat.push(lat); series.loss.push(Math.min(100, loss + congestion * 8)); series.conv.push(performance.now() < convergeUntil ? lastConv : 0);
  for (const k in series) if (series[k].length > 120) series[k].shift();
  ui('kThr').textContent = thr.toFixed(1); ui('kLat').textContent = lat.toFixed(0); ui('kLoss').textContent = series.loss.at(-1).toFixed(2);
  ui('kLoss').parentElement.classList.toggle('bad', series.loss.at(-1) > 1);
  spark('cThr', series.thr, '#5cf2ff', 18, v => v.toFixed(1) + ' Tbps'); spark('cLat', series.lat, '#ffd166', null, v => v.toFixed(0) + ' ms');
  spark('cLoss', series.loss, '#ff5d8f', null, v => v.toFixed(2) + ' %'); spark('cConv', series.conv, '#c77dff', null, v => (v ? v.toFixed(1) + ' s' : 'stable'));
  // cable util bars
  const tot = Object.values(stats.cableLoad).reduce((a, b) => a + b, 0) || 1;
  ui('cutil').innerHTML = CABLES.filter(c => c.status !== 'retired').map(c => { const u = c.edges.every(e => e.cut) ? 0 : Math.min(99, (stats.cableLoad[c.id] || 0) / tot * 100 / Math.max(0.03, c.share) * 0.42 * load + 8); return `<div class="cu"><span>${c.name}</span><div class="bar"><i style="width:${u}%;background:${u > 85 ? '#ff3355' : u > 65 ? '#ffd166' : CAB_COL[c.id]}"></i></div><em>${c.edges.every(e => e.cut) ? 'CUT' : u.toFixed(0) + '%'}</em></div>`; }).join('');
  stats.cableLoad = {}; winSp = 0; winDr = 0;
  // flow mix
  const ct = stats.cat; const sum = Object.values(ct).reduce((a, b) => a + b, 0) || 1;
  ui('mix').innerHTML = Object.entries(FLOW).filter(([k]) => ct[k]).map(([k, f]) => `<div class="mx"><i style="--c:${f.c}"></i><span>${f.label}</span><div class="bar"><b style="width:${(ct[k] / sum * 100).toFixed(1)}%;background:${f.c}"></b></div><em>${(ct[k] / sum * 100).toFixed(0)}%</em></div>`).join('');
  for (const k in ct) ct[k] *= 0.6;
  ui('pcount').textContent = packets.length;
  // queues + heat
  for (const n of nodes) if (n.queue) {
    let l = 0; for (const e of adj.get(n.id)) l += e.load; const f = Math.min(0.999, 0.08 + l / (n.tier === 'core' ? 900 : 120) + (scen.ddos && scen.ddos.phase === 1 && n === scen.ddos.target.city ? 0.9 : 0));
    n.queue.material.uniforms.uFill.value = f; n.queue.material.uniforms.uCol.value.set(f > 0.85 ? '#ff3355' : f > 0.6 ? '#ffd166' : '#4dffb5'); n.qf = f;
  }
  if (layers.heat.visible) drawHeat();
  for (const e of edges) e.load *= 0.5;
  if (inspectNode) { const q = inspectNode.qf ?? Math.random() * 0.3; const iq = ui('iq'); if (iq) { iq.style.width = (q * 100) + '%'; ui('icpu').style.width = (20 + q * 60 + Math.random() * 8) + '%'; let l = 0; adj.get(inspectNode.id).forEach(e => l += e.load); ui('ipps').textContent = Math.round(l * 2400 * load).toLocaleString(); document.querySelectorAll('#insp [data-e]').forEach(b => { const e = edges[+b.dataset.e]; b.textContent = e.cut ? 'DOWN' : Math.min(99, 4 + e.load * 3).toFixed(0) + '%'; }); } }
}, 250);
let heatObj = null;
function drawHeat() {
  if (heatObj) { gHeat.remove(heatObj); heatObj.geometry.dispose(); }
  const segs = []; const c1 = new THREE.Color('#4dffb5'), c2 = new THREE.Color('#ffd166'), c3 = new THREE.Color('#ff3355');
  for (const e of edges) { if (!['fiber', 'microwave', 'aerial', 'subsea', 'xborder'].includes(e.type)) continue; const u = Math.min(1, e.load / (e.type === 'subsea' ? 160 : 60)); const c = u < 0.5 ? c1.clone().lerp(c2, u * 2) : c2.clone().lerp(c3, (u - 0.5) * 2); for (let i = 0; i < e.pts.length - 1; i += Math.max(1, Math.floor(e.pts.length / 18))) { const j = Math.min(e.pts.length - 1, i + Math.max(1, Math.floor(e.pts.length / 18))); segs.push({ a: e.pts[i].clone().setZ(e.pts[i].z + 0.03), b: e.pts[j].clone().setZ(e.pts[j].z + 0.03), ca: '#' + c.getHexString() }); } }
  heatObj = fatSegs(segs, { vertexColors: true, linewidth: 5, opacity: 0.9 }); gHeat.add(heatObj);
}

/* ============================================================
   MAIN LOOP
   ============================================================ */
let lastNF = -1; const clock = new THREE.Clock(); const tmp = [0, 0, 0]; let tAll = 0;
flyTo('overview', 3800);
setTimeout(() => ui('intro').classList.add('off'), 2600);
log('Simulation started — representative topology of Pakistan\'s internet', 'good');
updateCableList();
function frame() {
  const dt = Math.min(0.05, clock.getDelta()); tAll += dt; const sdt = playing ? dt * speed : 0;
  if (fly) { const f = Math.min(1, (performance.now() - fly.s) / fly.dur); const e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2; camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0, fly.t1, e); if (f >= 1) fly = null; }
  if (tour && !fly && performance.now() > tourNext) { flyTo(TOUR[tourIdx++ % TOUR.length], 3500); tourNext = performance.now() + 7500; }
  controls.update();
  // sim time
  if (playing) { simHour = (simHour + sdt * (2 / 60) * 1) % 24; ui('tod').value = simHour; ui('kClock').textContent = fmtClock(simHour); }
  // spawn
  if (playing) {
    spawnAcc += sdt * 230 * diurnal(simHour); while (spawnAcc > 1) { spawnAcc--; spawnNormal(); }
    spawnScenario(sdt);
  }
  // packets
  let j = 0;
  for (let i = packets.length - 1; i >= 0; i--) {
    const pk = packets[i]; pk.d += pk.v * sdt;
    if (pk.dropAt !== null && pk.d >= pk.dropAt) { samplePath(pk.path, pk.dropAt, tmp); if (Math.random() < 0.35) burst(new THREE.Vector3(...tmp), pk.cat === 'atk' ? '#ff4dd8' : COL.attack, 0.12, 0.5); stats.dropped++; winDr++; packets.splice(i, 1); continue; }
    if (pk.d >= pk.path.total) { if (pk.sink) { samplePath(pk.path, pk.path.total, tmp); if (Math.random() < 0.25) burst(new THREE.Vector3(...tmp), COL.attack, 0.3, 0.6); if (scen.hijack) { stats.dropped++; winDr++; } } stats.delivered++; packets.splice(i, 1); continue; }
  }
  for (const pk of packets) {
    for (let k = 0; k < TRAIL; k++) {
      samplePath(pk.path, pk.d - k * 0.045, tmp); const o = j * 3; pPos[o] = tmp[0]; pPos[o + 1] = tmp[1]; pPos[o + 2] = tmp[2];
      pCol[o] = pk.col.r; pCol[o + 1] = pk.col.g; pCol[o + 2] = pk.col.b; pSize[j] = pk.size * (1 - k * 0.28); pAlpha[j] = k === 0 ? 1 : 0.45 / k; j++;
    }
  }
  pGeo.setDrawRange(0, j); pGeo.attributes.position.needsUpdate = pGeo.attributes.aColor.needsUpdate = pGeo.attributes.aSize.needsUpdate = pGeo.attributes.aAlpha.needsUpdate = true;
  // fx
  for (let i = bursts.length - 1; i >= 0; i--) { const b = bursts[i]; b.t += dt; const f = b.t / b.life; if (f >= 1) { gFX.remove(b.m); b.m.material.dispose(); bursts.splice(i, 1); continue; } const s = b.s * (0.3 + f); b.m.scale.set(s, s, s); b.m.material.opacity = 1 - f; b.m.lookAt(camera.position); }
  pulseRings.forEach((r, i) => { const f = (tAll * 0.7 + i * 0.13) % 1; r.scale.setScalar(0.6 + f * 1.6); r.material.opacity = 0.7 * (1 - f); });
  hiLines.forEach(l => { if (l.userData.anim) l.material.dashOffset -= dt * 0.6; });
  gIXP.children.forEach(m => { if (m.userData.spin) { m.rotation.z += dt * 1.2; m.position.z = NET + 0.08 + Math.sin(tAll * 2) * 0.015; } });
  if (SAT.mesh) { SAT.mesh.rotation.z = Math.sin(tAll * 0.4) * 0.2; }
  cutMarks.forEach(g => { g.children[1].scale.setScalar(1 + Math.sin(tAll * 8) * 0.15); });
  seaMat.uniforms.uTime.value = tAll;
  // label LOD + constant-ish screen size for node glyphs
  const dist = camera.position.distanceTo(controls.target);
  const nf = Math.min(1.25, Math.max(0.2, dist / 13));
  if (Math.abs(nf - lastNF) > 0.005) { lastNF = nf; for (const n of nodes) if (n.mesh && n.tier !== 'sat') n.mesh.scale.setScalar(n.tier === 'intl' ? Math.max(nf, 0.6) : nf); window.__accScale(Math.max(0.35, nf)); }
  for (const o of labelObjs) { const v = dist >= o.userData.minD && dist <= o.userData.maxD; if (o.visible !== v) o.visible = v; }
  // hover
  if (hoverPending) { const n = pick(); hoverNode = n; tip(n, hoverPending[0], hoverPending[1]); renderer.domElement.style.cursor = n ? 'pointer' : ''; hoverPending = null; }
  composer.render(); labelRenderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); labelRenderer.setSize(innerWidth, innerHeight);
  lineMats.forEach(m => m.resolution.set(innerWidth, innerHeight));
});

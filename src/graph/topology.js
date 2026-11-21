// The network graph: cities, routers, landing stations, IXPs, data centres,
// international endpoints, satellite and microwave relays.
// REPRESENTATIVE topology: internal ISP topology is not public. Corridors follow
// motorways / national highways and the operator per corridor is illustrative.
import * as THREE from 'three';
import CITIES from '../../data/cities.json';
import { P, NET } from '../geo/projection.js';
import { snapToCoast } from '../geo/coast.js';

export const CORE = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Hyderabad', 'Sukkur', 'Gwadar'];
export const AGG = ['Gujranwala', 'Sialkot', 'Sargodha', 'Bahawalpur', 'Rahim Yar Khan', 'Sahiwal', 'Okara', 'Kasur', 'Gujrat', 'Jhelum', 'Attock City', 'Mardan', 'Mingora', 'Abbottabad', 'Mansehra', 'Kohat', 'Bannu', 'Dera Ismail Khan', 'Dera Ghazi Khan', 'Muzaffargarh', 'Khanewal', 'Jhang Sadr', 'Chiniot', 'Mianwali', 'Larkana', 'Nawabshah', 'Mirpur Khas', 'Jacobabad', 'Dadu', 'Thatta', 'Badin', 'Umarkot', 'Mithi', 'Kashmore', 'Khuzdar', 'Kalat', 'Mastung', 'Sibi', 'Loralai', 'Zhob', 'Chaman', 'Nushki', 'Dalbandin', 'Nok Kundi', 'Taftan', 'Turbat', 'Panjgur', 'Kharan', 'Pasni', 'Ormara', 'Hub', 'Awaran', 'Muzaffarabad', 'New Mirpur', 'Kotli', 'Rawalakot', 'Gilgit', 'Skardu', 'Chitral', 'Besham', 'Dasu', 'Chilas', 'Karimabad', 'Sost', 'Khunjerab Pass', 'Torkham', 'Shekhupura', 'Vehari'];

// Relay and border towns missing from GeoNames: [lon, lat, population]
const EXTRA = {
  Hub: [66.89, 25.05, 90000], Taftan: [61.56, 28.96, 8000], 'Nok Kundi': [62.75, 28.82, 8000], Karimabad: [74.66, 36.32, 15000],
  Sost: [74.82, 36.69, 3000], 'Khunjerab Pass': [75.42, 36.85, 0], Torkham: [71.09, 34.13, 5000], Besham: [72.88, 34.93, 20000],
  Chilas: [74.10, 35.42, 20000], Dasu: [73.29, 35.29, 10000], Kalat: [66.58, 29.03, 20000], Nushki: [66.02, 29.55, 40000],
  Awaran: [65.23, 26.46, 10000], Chitral: [71.79, 35.85, 50000], Rawalakot: [73.76, 33.86, 50000], Dadu: [67.78, 26.73, 150000],
  Kashmore: [69.58, 28.43, 40000], Vehari: [72.35, 30.04, 120000], Khanewal: [71.93, 30.30, 200000]
};

export const CABLE_LIST = [
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

// Sea routes out of Karachi, as lon/lat control points.
const DIR_ROUTE = {
  W: [[66.45, 24.35], [65.0, 24.12], [62.6, 24.3], [59.6, 24.75]],
  E: [[67.0, 24.2], [67.8, 22.9], [69.4, 21.5], [71.4, 20.6]],
  SW: [[66.5, 24.15], [65.2, 22.8], [63.2, 21.0], [61.0, 19.6]]
};

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function buildTopology() {
  const cities = CITIES.map(c => ({ ...c, n: norm(c.n) }));
  for (const [n, [lon, lat, p]] of Object.entries(EXTRA)) { const ex = cities.find(c => c.n === n); if (ex) { if (!ex.p) ex.p = p; } else cities.push({ n, lon, lat, p }); }

  const nodes = [], edges = [], adj = new Map(), byName = {};
  function addNode(o) { o.id = nodes.length; o.pos = o.pos || P(o.lon, o.lat, NET); nodes.push(o); adj.set(o.id, []); if (o.name && !byName[o.name]) byName[o.name] = o; return o; }
  function addEdge(a, b, type, ops = [], pts = null, extra = {}) {
    if (!a || !b) return null;
    const e = Object.assign({ id: edges.length, a: a.id, b: b.id, type, ops, pts: pts || [a.pos, b.pos], cut: false, load: 0 }, extra);
    e.len = 0; for (let i = 1; i < e.pts.length; i++) e.len += e.pts[i].distanceTo(e.pts[i - 1]);
    edges.push(e); adj.get(a.id).push(e); adj.get(b.id).push(e); return e;
  }

  const seen = new Set();
  for (const c of cities) {
    if (seen.has(c.n)) continue; seen.add(c.n);
    addNode({ name: c.n, lon: c.lon, lat: c.lat, pop: c.p, tier: CORE.includes(c.n) ? 'core' : AGG.includes(c.n) ? 'agg' : 'access', kind: 'city' });
  }
  const N = n => byName[n];
  const R = (names, type, ops) => { for (let i = 0; i < names.length - 1; i++) addEdge(N(names[i]), N(names[i + 1]), type, ops); };

  // fibre corridors (operators illustrative)
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

  // Karachi gateway: landing stations, IXPs, data centres
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
  const attach = (name, cityName, dx, dy, tier) => { const city = N(cityName); const o = addNode({ name, pos: city.pos.clone().add(new THREE.Vector3(dx, dy, 0)), tier, kind: tier, lon: city.lon, lat: city.lat }); addEdge(o, city, 'metro', []); o.city = city; return o; };
  const IXP = [['PKIX Islamabad', 'Islamabad', 0.08, 0.06], ['PKIX Karachi', 'Karachi', 0.12, 0.1], ['PKIX Lahore', 'Lahore', 0.09, 0.06]].map(([n, c, dx, dy]) => attach(n, c, dx, dy, 'ixp'));
  const DCS = [['Cloudflare edge · Karachi', 'Karachi', -0.02, 0.15], ['Cloudflare edge · Lahore', 'Lahore', -0.09, 0.06], ['Cloudflare edge · Islamabad', 'Islamabad', -0.09, 0.04], ['TWA Tier III data centre', 'Karachi', -0.15, 0.08]].map(([n, c, dx, dy]) => attach(n, c, dx, dy, 'dc'));

  // international endpoints
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

  // submarine cables
  const CABLES = CABLE_LIST.map(c => ({ ...c }));
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

  // planned: Gwadar landing + CPEC Phase II fibre
  const plannedEdges = [];
  {
    plannedEdges.push(addEdge(CLS.gwadar, INTL.W, 'planned', ['SCO'], seaPath(CLS.gwadar.pos, [[62.1, 24.75], [60.8, 24.6], [59.6, 24.75]], 0.0, 'W'), { plannedCable: true }));
    const names = ['Rawalpindi', 'Dera Ismail Khan', 'Zhob', 'Quetta', 'Kalat', 'Panjgur', 'Turbat', 'Gwadar'];
    for (let i = 0; i < names.length - 1; i++) { const a = N(names[i]), b = N(names[i + 1]), off = new THREE.Vector3(0.05, -0.05, 0); plannedEdges.push(addEdge(a, b, 'planned', ['SCO'], [a.pos.clone().add(off), b.pos.clone().add(off)])); }
    plannedEdges.push(edges.find(e => e.a === CLS.gwadar.id && e.type === 'planned' && !e.plannedCable));
    plannedEdges.forEach(e => e.planned = true);
  }

  // satellite
  const SAT = addNode({ name: 'PakSat-MM1 satellite (GEO 38.2°E)', pos: P(62.6, 31.0, 3.6), tier: 'sat', kind: 'sat' });
  const GW = ['Karachi', 'Lahore', 'Islamabad'].map(c => { const city = N(c); const g = addNode({ name: `Satellite gateway · ${c}`, pos: city.pos.clone().add(new THREE.Vector3(0.1, -0.08, 0)), tier: 'gw', kind: 'gw', lon: city.lon, lat: city.lat }); addEdge(g, city, 'metro', []); g.city = city; return g; });
  const VSAT = ['Chitral', 'Skardu', 'Mithi', 'Panjgur', 'Kharan', 'Awaran', 'Dalbandin', 'Zhob', 'Sost', 'Nok Kundi'].map(c => { const city = N(c); const v = addNode({ name: `VSAT terminal · ${c}`, pos: city.pos.clone().add(new THREE.Vector3(0.05, 0.05, 0)), tier: 'vsat', kind: 'vsat', lon: city.lon, lat: city.lat }); addEdge(v, city, 'metro', []); v.city = city; return v; });
  const satCurve = (a, b) => { const m = a.clone().lerp(b, 0.5); m.z += 1.2; return new THREE.QuadraticBezierCurve3(a, m, b).getPoints(40); };
  [...GW, ...VSAT].forEach(g => addEdge(g, SAT, 'sat', ['PakSat'], satCurve(g.pos, SAT.pos)));

  // last mile: every remaining city hangs off its nearest hub
  const hubs = nodes.filter(n => n.kind === 'city' && n.tier !== 'access');
  for (const n of nodes.filter(n => n.kind === 'city' && n.tier === 'access')) {
    let best = null, bd = 1e9; for (const h of hubs) { const d = h.pos.distanceToSquared(n.pos); if (d < bd) { bd = d; best = h; } }
    n.remote = (n.lon < 67.6 && n.lat > 25.3) || n.lat > 34.9 || Math.sqrt(bd) > 0.7;
    addEdge(n, best, n.remote ? 'mwaccess' : 'access', []); n.parent = best;
  }
  const accessNodes = nodes.filter(n => n.kind === 'city' && n.tier === 'access');

  return { nodes, edges, adj, byName, N, CABLES, CLS, IXP, DCS, INTL, SAT, GW, VSAT, towers, cableEdges, plannedEdges, accessNodes };
}

export const other = (e, u) => (e.a === u ? e.b : e.a);

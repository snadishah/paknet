// Map labels (CSS2DRenderer). Each label shows only within a camera-distance band.
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { P, NET, TOP } from '../geo/projection.js';
import { CORE } from '../graph/topology.js';
import { layers } from './scene.js';

const labelObjs = [], boundLabels = [];

function label(html, pos, cls, maxD = 999, minD = 0, off = null) {
  const d = document.createElement('div'); d.className = 'lbl ' + cls;
  d.innerHTML = off ? `<span style="position:relative;left:${off[0]}px;top:${off[1]}px">${html}</span>` : html;
  const o = new CSS2DObject(d); o.position.copy(pos); o.userData = { minD, maxD }; layers.labels.add(o); labelObjs.push(o); return o;
}

const OFF = { Rawalpindi: [30, 12], Islamabad: [4, -10], Faisalabad: [-28, 0], Lahore: [20, -2], Peshawar: [-20, 0], "TWA landing station · Hawke's Bay": [-95, -16], "PTCL landing station · Hawke's Bay": [-105, 10], 'Cybernet landing station (PEACE)': [-40, 32], 'PTCL landing station · Clifton / Sea View': [110, 14], 'Gwadar landing station (planned)': [-20, 18] };

export function buildLabels(G) {
  const { nodes, N, SAT, CABLES } = G;
  for (const n of nodes) {
    const p = n.pos.clone();
    if (n.tier === 'core') label(n.name, p.setZ(NET + 0.16), 'core', 999, 0, OFF[n.name]);
    else if (n.tier === 'agg') label(n.name, p.setZ(NET + 0.1), 'agg', 11);
    else if (n.tier === 'cls') { const l = label(n.name, p.setZ(NET + 0.1), 'small cls', n.planned ? 999 : 3.4, 0, OFF[n.name]); if (n.planned) { l.element.classList.add('planned'); boundLabels.push([l, layers.planned]); } }
    else if (n.tier === 'ixp' || n.tier === 'dc') label(n.name, p.setZ(NET + 0.1), 'small', 3.4);
    else if (n.tier === 'intl' && !n.hideLabel) label(n.name + ' →', p.setZ(0.25), 'intl');
    else if (n.tier === 'access' && n.pop > 150000 && !CORE.some(c => N(c).pos.distanceTo(n.pos) < 0.3)) label(n.name, p.setZ(NET + 0.06), 'acc', 6);
  }
  { const sl = label('PakSat-MM1', SAT.pos.clone().setZ(SAT.pos.z + 0.35), 'core sat'); boundLabels.push([sl, layers.satellite]); }
  for (const [t, lo, la] of [['SINDH', 68.7, 26.3], ['PUNJAB', 71.8, 29.3], ['BALOCHISTAN', 65.4, 28.0], ['KHYBER<br>PAKHTUNKHWA', 70.9, 32.75], ['GILGIT-BALTISTAN', 74.9, 35.95], ['AJK', 73.95, 34.55]]) label(t, P(lo, la, TOP + 0.01), 'prov', 999, 7);
  for (const [t, lo, la] of [['AFGHANISTAN', 66.3, 33.4], ['IRAN', 59.4, 28.3], ['INDIA', 75.6, 26.6], ['CHINA', 79.0, 37.0], ['ARABIAN SEA', 64.4, 21.6]]) label(t, P(lo, la, 0.02), 'country', 999, 6);
  CABLES.forEach((c, i) => { if (c.status === 'retired') return; const e = c.edges[0]; const p = e.pts[Math.floor(e.pts.length * (0.5 + (i % 3) * 0.08))]; c.label = label(c.name, p.clone().setZ(0.06), 'cab', 9); });
}

// Show/hide labels by camera distance; labels bound to a hidden layer stay hidden.
export function updateLabels(dist) {
  for (const o of labelObjs) { const v = dist >= o.userData.minD && dist <= o.userData.maxD; if (o.visible !== v) o.visible = v; }
  for (const [l, g] of boundLabels) if (!g.visible) l.visible = false;
}

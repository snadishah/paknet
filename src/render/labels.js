// Map labels: a DOM layer managed by hand (not CSS2D) so labels can fade by
// distance, avoid each other, stay under a cap and hide behind the Earth.
// Each label shows only while the camera's range is inside [minR, maxR] km.
// Story callouts still use CSS2D objects (addCallout).
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { CORE } from '../graph/topology.js';
import { camera, scene } from './scene.js';
import { fromLatLon, G3 } from './geo3.js';
import { pose, altitudeKm } from './globecam.js';

const MAX_LABELS = 12;
const layerEl = document.createElement('div'); layerEl.id = 'maplabels'; document.getElementById('app').appendChild(layerEl);
export const labelState = { enabled: true, extra: null }; // extra: (label) => bool overrides
const labels = [];

// pos: Vector3 (globe). prio: lower = more important. node: optional sim node (click → info card).
export function addLabel(text, pos, { cls = '', minR = 0, maxR = 1e9, prio = 5, node = null, layer = null, key = null } = {}) {
  const el = document.createElement('div'); el.className = 'ml ' + cls; el.textContent = text; layerEl.appendChild(el);
  const l = { text, pos, el, minR, maxR, prio, node, layer, key: key || text, on: false, w: text.length * (cls.includes('country') ? 10.5 : 7.6) + 16, h: 20, forced: false };
  if (node) { el.classList.add('click'); el.onclick = () => labelState.onClick?.(node); }
  labels.push(l); labels.sort((a, b) => a.prio - b.prio); return l;
}
export function removeLabel(l) { const i = labels.indexOf(l); if (i >= 0) labels.splice(i, 1); l.el.remove(); }
export const findLabel = key => labels.find(l => l.key === key);

export function buildLabels(G) {
  const { nodes, N, CABLES } = G;
  // From space: countries and seas
  for (const [t, la, lo, p] of [['PAKISTAN', 29.8, 69.0, 0], ['AFGHANISTAN', 33.6, 65.8, 2], ['IRAN', 32.0, 54.5, 2], ['INDIA', 22.5, 78.5, 2], ['CHINA', 35.5, 90.0, 2], ['Arabian Sea', 16.5, 64.0, 3], ['OMAN', 21.0, 57.0, 4], ['SAUDI ARABIA', 23.5, 45.0, 4], ['Red Sea', 20.5, 38.5, 4], ['Indian Ocean', 2, 72, 4], ['UAE', 24.2, 54.6, 5]])
    addLabel(t, fromLatLon(la, lo), { cls: t === t.toUpperCase() ? 'country' : 'sea', minR: 1800, maxR: 40000, prio: p });
  // Near Pakistan: big cities and hubs
  for (const n of nodes) {
    const p = n.gpos;
    if (n.tier === 'core') addLabel(n.name, p, { cls: 'city', minR: 20, maxR: 5000, prio: ['Karachi', 'Lahore', 'Islamabad'].includes(n.name) ? 1 : 3, node: n });
    else if (n.tier === 'agg' && n.pop > 250000) addLabel(n.name, p, { cls: 'town', minR: 15, maxR: 900, prio: 6, node: n });
    else if (n.tier === 'cls') addLabel(n.planned ? 'Gwadar landing (planned)' : n.name.replace(' landing station', ''), p, { cls: 'small' + (n.planned ? ' planned' : ''), minR: 0.5, maxR: n.planned ? 1500 : 90, prio: 7, node: n, layer: n.planned ? 'planned' : 'gateways' });
    else if (n.tier === 'ixp' || n.tier === 'dc') addLabel(n.name, p, { cls: 'small', minR: 0.5, maxR: 60, prio: 8, node: n, layer: 'gateways' });
    else if (n.tier === 'intl' && !n.hideLabel) addLabel(n.name + ' →', p, { cls: 'intl', minR: 300, maxR: 4500, prio: 5, node: n });
    else if (n.tier === 'gw') addLabel(n.name, p, { cls: 'small sat', minR: 0.5, maxR: 80, prio: 8, node: n, layer: 'satellite' });
    else if (n.tier === 'access' && n.pop > 150000 && !CORE.some(c => N(c).pos.distanceTo(n.pos) < 0.3)) addLabel(n.name, p, { cls: 'town', minR: 5, maxR: 400, prio: 9, node: n });
  }
  CABLES.forEach((c, i) => { if (c.status === 'retired') return; const e = c.edges[0]; const gp = e.gpts; c.label = addLabel(c.name, gp[Math.floor(gp.length * (0.55 + (i % 3) * 0.1))], { cls: 'cab', minR: 250, maxR: 2600, prio: 6, layer: 'cables', key: 'cable:' + c.id }); });
}

// Show labels whose band contains the current range, best priority first, no overlaps.
const v = new THREE.Vector3(), toCam = new THREE.Vector3(), boxes = [];
let frameNo = 0;
export function updateLabels(layers) {
  if ((frameNo++ & 1) === 1) return; // every other frame is plenty
  const range = pose.range, alt = altitudeKm; boxes.length = 0; let shown = 0;
  for (const l of labels) {
    let want = labelState.enabled && range >= l.minR && range <= l.maxR && (!l.layer || layers[l.layer]?.visible !== false);
    if (labelState.extra) { const x = labelState.extra(l); if (x != null) want = x; }
    if (want && shown >= MAX_LABELS) want = false;
    if (want) {
      // behind the Earth? (the camera must be on the outer side of the point's horizon plane)
      toCam.copy(camera.position).sub(l.pos); if (toCam.dot(l.pos) < 0 && l.pos.lengthSq() < 7000 * 7000) want = false;
    }
    let sx = 0, sy = 0;
    if (want) {
      v.copy(l.pos).project(camera);
      if (v.z > 1) want = false;
      else {
        sx = (v.x + 1) / 2 * innerWidth; sy = (1 - v.y) / 2 * innerHeight;
        if (sx - l.w / 2 < 4 || sx + l.w / 2 > innerWidth - 4 || sy < 30 || sy > innerHeight - 4) want = false;
      }
      if (want) {
        const b = [sx - l.w / 2, sy - 26, sx + l.w / 2, sy - 6];
        for (const o of boxes) if (b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) { want = false; break; }
        if (want) boxes.push(b);
      }
    }
    if (want) { shown++; l.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`; }
    if (want !== l.on) { l.on = want; l.el.classList.toggle('on', want); }
  }
  void alt;
}

// Story callouts: a card pinned to a place on the map (flat or globe position).
const callouts = [];
export function addCallout(pos, html) {
  const d = document.createElement('div'); d.className = 'callout'; d.innerHTML = `<i></i>${html}`;
  const o = new CSS2DObject(d); o.position.copy(G3(pos)); scene.add(o); callouts.push(o); return o;
}
export function clearCallouts() { callouts.forEach(o => { scene.remove(o); o.element.remove(); }); callouts.length = 0; }
export const hasCallouts = () => callouts.length > 0;

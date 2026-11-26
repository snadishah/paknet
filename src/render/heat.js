// Link-load layer: colours links green → yellow → red by measured utilisation (e.util, 0–1).
import * as THREE from 'three';
import { layers, fatSegs, disposeLine } from './scene.js';
import { edgeGlobe } from './geo3.js';

let heatObj = null;
const HEAT_TYPES = ['fiber', 'microwave', 'aerial', 'subsea', 'xborder', 'mwbackup'];
const c1 = new THREE.Color('#3fb27f'), c2 = new THREE.Color('#e8c35a'), c3 = new THREE.Color('#e5484d');

export function drawHeat(G, net) {
  const gHeat = layers.heat;
  if (heatObj) { gHeat.remove(heatObj); disposeLine(heatObj); }
  const segs = [];
  for (const e of G.edges) {
    if (!HEAT_TYPES.includes(e.type) || !net.usable(e)) continue;
    const u = Math.min(1, e.util || 0); const c = u < 0.5 ? c1.clone().lerp(c2, u * 2) : c2.clone().lerp(c3, (u - 0.5) * 2);
    const p = edgeGlobe(e), st = Math.max(1, Math.floor(p.length / 16)), hex = '#' + c.getHexString();
    for (let i = 0; i < p.length - 1; i += st) segs.push({ a: p[i], b: p[Math.min(p.length - 1, i + st)], c: hex });
  }
  heatObj = fatSegs(segs, { vertexColors: true, linewidth: 3, opacity: 0.95 }); heatObj.renderOrder = 5; gHeat.add(heatObj);
}

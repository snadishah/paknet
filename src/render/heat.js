// Link-load layer: colours links green → yellow → red by recent load.
import * as THREE from 'three';
import { lift } from '../geo/projection.js';
import { layers, fatSegs } from './scene.js';

let heatObj = null;
const HEAT_TYPES = ['fiber', 'microwave', 'aerial', 'subsea', 'xborder', 'mwbackup'];

export function drawHeat(G, net) {
  const gHeat = layers.heat;
  if (heatObj) { gHeat.remove(heatObj); heatObj.geometry.dispose(); }
  const segs = [], c1 = new THREE.Color('#16a34a'), c2 = new THREE.Color('#eab308'), c3 = new THREE.Color('#dc2626');
  for (const e of G.edges) {
    if (!HEAT_TYPES.includes(e.type) || !net.usable(e)) continue;
    const u = Math.min(1, e.load / (e.type === 'subsea' ? 120 : 45)); const c = u < 0.5 ? c1.clone().lerp(c2, u * 2) : c2.clone().lerp(c3, (u - 0.5) * 2);
    const st = Math.max(1, Math.floor(e.pts.length / 16));
    for (let i = 0; i < e.pts.length - 1; i += st) { const j = Math.min(e.pts.length - 1, i + st); segs.push({ a: lift(e.pts[i], 0.006), b: lift(e.pts[j], 0.006), c: '#' + c.getHexString() }); }
  }
  heatObj = fatSegs(segs, { vertexColors: true, linewidth: 4, opacity: 0.95 }); gHeat.add(heatObj);
}

// Pakistan's shape as a soft-edged equirectangular mask (white inside, black
// outside), painted once from the simplified border data. The globe and the tile
// shaders use it to dim the neighbouring countries a little, so Pakistan stands out.
import * as THREE from 'three';
import BORDERS from '../data/borders.json';

const W = 2048, H = 1024;
function paint() {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.filter = 'blur(2px)'; g.fillStyle = '#fff';
  for (const poly of BORDERS.PAK || []) {
    g.beginPath(); poly[0].forEach(([lon, lat], i) => { const x = (lon + 180) / 360 * W, y = (90 - lat) / 180 * H; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.flipY = true; t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}
export const pakMask = { uniform: { value: paint() } };
// Pakistan's outer outline rings as [lon, lat] arrays (for the border line).
export const pakRings = (BORDERS.PAK || []).map(p => p[0]);

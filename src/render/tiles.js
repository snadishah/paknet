// Close-up imagery: Sentinel-2 cloudless (EOX, 2016 layer, CC BY 4.0) streamed
// as Web-Mercator tiles when the camera is low over Pakistan. Only the area
// around the view is loaded, at most 6 requests at a time, kept in a small
// cache and disposed when no longer needed. Offline → the base globe shows.
//
// Tiles are curved patches on the sphere drawn right after the Earth with depth
// testing off (back faces culled), so the coarse globe never pokes through them.
import * as THREE from 'three';
import { latLonToEcef } from '../geo/globe.js';
import { scene, renderer, camera } from './scene.js';
import { pose, altitudeKm } from './globecam.js';
import { globeUniforms } from './globe.js';

const URL = (z, x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${z}/${y}/${x}.jpg`;
export const ATTRIBUTION = 'Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)';
const BOX = { lat0: 19, lat1: 40, lon0: 56, lon1: 81 }; // Pakistan and its coast, with margin
const MAX_Z = 15, MAX_CONCURRENT = 6, CACHE = 180, START_KM = 1500, MAX_DRAWN = 50;

export const tileState = { enabled: true, active: false, loaded: 0, failed: 0, online: true };
const group = new THREE.Group(); group.name = 'tiles'; group.renderOrder = -1.5;
const cache = new Map(); // key → { mesh, tex, status, used, z }
let inflight = 0; const queue = [];
const loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous');

const lat2y = (lat, z) => (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** z;
const y2lat = (y, z) => { const n = Math.PI - 2 * Math.PI * y / 2 ** z; return 180 / Math.PI * Math.atan(Math.sinh(n)); };
const lon2x = (lon, z) => (lon + 180) / 360 * 2 ** z;
const x2lon = (x, z) => x / 2 ** z * 360 - 180;

function tileMesh(z, x, y, tex) {
  const S = z < 9 ? 12 : 6, pos = [], uv = [], idx = [], a = [0, 0, 0];
  for (let j = 0; j <= S; j++) for (let i = 0; i <= S; i++) {
    const lat = y2lat(y + j / S, z), lon = x2lon(x + i / S, z); latLonToEcef(lat, lon, 0, a); pos.push(...a); uv.push(i / S, 1 - j / S);
  }
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const p = j * (S + 1) + i, q = p + S + 1; idx.push(p, q, p + 1, p + 1, q, q + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  // the Earth shader's day colours are in sRGB; keep the tiles looking the same
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false, depthWrite: true });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = -1.9 + z * 0.001; mesh.frustumCulled = true; g.computeBoundingSphere(); return mesh;
}

function request(z, x, y) {
  const key = `${z}/${x}/${y}`; let t = cache.get(key);
  if (t) { t.used = performance.now(); return t; }
  t = { key, z, x, y, status: 'queued', used: performance.now(), mesh: null, tex: null, born: 0 }; cache.set(key, t); queue.push(t); return t;
}
function pump() {
  while (inflight < MAX_CONCURRENT && queue.length) {
    const t = queue.shift(); if (t.status !== 'queued') continue;
    t.status = 'loading'; inflight++;
    loader.load(URL(t.z, t.x, t.y), tex => {
      inflight--; tileState.online = true;
      if (!cache.has(t.key)) { tex.dispose(); return; }
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      t.tex = tex; t.mesh = tileMesh(t.z, t.x, t.y, tex); t.status = 'ready'; t.born = performance.now(); group.add(t.mesh); tileState.loaded++;
    }, undefined, () => { inflight--; t.status = 'failed'; t.failedAt = performance.now(); tileState.failed++; tileState.online = false; });
  }
}
const childrenOf = t => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => `${t.z + 1}/${t.x * 2 + dx}/${t.y * 2 + dy}`);
function dispose(t) { if (t.mesh) { group.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.dispose(); } t.tex?.dispose(); cache.delete(t.key); }

export function initTiles() { scene.add(group); }
// Debug summary (verify / zoom probe): visible tiles per zoom with their mean opacity.
export function tileDebug() { const by = {}; for (const t of cache.values()) if (t.mesh?.visible) { const b = by[t.z] ||= [0, 0]; b[0]++; b[1] += t.mesh.material.opacity; } return Object.entries(by).map(([z, [n, o]]) => `${z}:${n}@${(o / n).toFixed(2)}`).join(' ') + ` gv=${group.visible}`; }

let last = 0;
export function updateTiles() {
  const now = performance.now();
  const inBox = pose.lat > BOX.lat0 && pose.lat < BOX.lat1 && pose.lon > BOX.lon0 && pose.lon < BOX.lon1;
  const active = tileState.enabled && inBox && altitudeKm < START_KM;
  tileState.active = active;
  const fade = active ? 1 - THREE.MathUtils.smoothstep(altitudeKm, START_KM * 0.45, START_KM) : 0;
  group.visible = fade > 0.01;
  if (active && now - last > 250) {
    last = now;
    // zoom so a tile pixel is about a screen pixel at the view centre
    const kmPerPx = 2 * pose.range * Math.tan(camera.fov * Math.PI / 360) / innerHeight;
    const zf = Math.log2(40075 * Math.cos(pose.lat * Math.PI / 180) / (256 * Math.max(1e-4, kmPerPx)));
    // one level coarser than pixel-perfect: a quarter of the tiles (and draw calls) for a small loss of sharpness
    const z = Math.max(5, Math.min(MAX_Z, Math.round(zf) - 1));
    const want = new Set();
    const ring = (zz, r) => { const cx = Math.floor(lon2x(pose.lon, zz)), cy = Math.floor(lat2y(pose.lat, zz)); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = cx + dx, y = cy + dy; if (y < 0 || y >= 2 ** zz) continue; const t = request(zz, ((x % 2 ** zz) + 2 ** zz) % 2 ** zz, y); want.add(t.key); } };
    if (z - 2 >= 5) ring(z - 2, 1); // backdrop: also covers the far part of tilted views
    ring(z, 2);
    // retry failed tiles after a minute; drop what's no longer wanted once the cache is full
    for (const t of cache.values()) if (t.status === 'failed' && now - t.failedAt > 60000) { t.status = 'queued'; queue.push(t); }
    // forget queued requests the view no longer needs (otherwise a fast zoom starves the fine tiles),
    // then fetch the backdrop first and the fine tiles nearest the centre next
    for (let i = queue.length - 1; i >= 0; i--) { const t = queue[i]; if (t.status === 'queued' && !want.has(t.key)) { queue.splice(i, 1); cache.delete(t.key); } }
    const dist = t => Math.hypot(t.x + 0.5 - lon2x(pose.lon, t.z), t.y + 0.5 - lat2y(pose.lat, t.z));
    queue.sort((a, b) => (a.z === z) - (b.z === z) || dist(a) - dist(b));
    // Over the cache limit: drop unwanted tiles, least recently used first, but keep the
    // coarse tiles around the view centre: they cover the screen while finer tiles load.
    if (cache.size > CACHE) {
      const nearCentre = t => Math.abs(t.x - Math.floor(lon2x(pose.lon, t.z))) <= 1 && Math.abs(t.y - Math.floor(lat2y(pose.lat, t.z))) <= 1 && t.z < z;
      [...cache.values()].filter(t => !want.has(t.key) && t.status !== 'loading' && !(t.status === 'ready' && nearCentre(t))).sort((a, b) => a.used - b.used).slice(0, cache.size - CACHE).forEach(dispose);
    }
    // Draw: wanted tiles and the coarse cover tiles around the view centre, but skip any tile
    // whose four children are already painted (each tile is a draw call).
    const painted = new Map();
    const isPainted = t => { if (!t || t.status !== 'ready' || now - t.born < 1050) return false; /* still fading in */ if (painted.has(t.key)) return painted.get(t.key); const kids = childrenOf(t); const p = kids.every(k => isPainted(cache.get(k))) || drawable(t); painted.set(t.key, p); return p; };
    // the previous level keeps the whole view covered (radius 2); older levels only near the centre
    const nearC = t => { const r = t.z === z - 1 || t.z === z + 1 ? 2 : 1; return Math.abs(t.x - Math.floor(lon2x(pose.lon, t.z))) <= r && Math.abs(t.y - Math.floor(lat2y(pose.lat, t.z))) <= r; };
    const drawable = t => want.has(t.key) || ((t.z < z || t.z === z + 1) && nearC(t));
    const shown = [];
    for (const t of [...cache.values()].sort((a, b) => b.z - a.z)) if (t.mesh) { t.was = t.mesh.visible; t.mesh.visible = drawable(t) && !childrenOf(t).every(k => isPainted(cache.get(k))); if (t.mesh.visible) shown.push(t); }
    // hard cap on tile draw calls: drop the finest tiles furthest from the view centre (coarse ones below still cover)
    if (shown.length > MAX_DRAWN) {
      const off = t => Math.hypot(t.x + 0.5 - lon2x(pose.lon, t.z), t.y + 0.5 - lat2y(pose.lat, t.z));
      const capped = shown.sort((a, b) => a.z - b.z || off(a) - off(b)).slice(MAX_DRAWN);
      capped.forEach(t => { t.mesh.visible = false; });
      // a capped tile's nearest loaded ancestor fills its place
      for (const t of capped) for (let zz = t.z - 1, x = t.x >> 1, y = t.y >> 1; zz >= 5; zz--, x >>= 1, y >>= 1) { const a = cache.get(`${zz}/${x}/${y}`); if (a?.mesh) { a.mesh.visible = true; break; } }
    }
    // a tile that comes back into view fades in again rather than popping
    for (const t of cache.values()) if (t.mesh && t.mesh.visible && t.was === false) t.born = Math.max(t.born, now - 600);
    pump();
  }
  if (!active && cache.size && now - last > 8000) { [...cache.values()].filter(t => t.status !== 'loading').forEach(dispose); last = now; }
  // match the globe shader's daylight at the view centre (flood: fully lit)
  const a = [0, 0, 0]; latLonToEcef(pose.lat, pose.lon, 0, a);
  const sun = globeUniforms.uSun.value, ndl = (a[0] * sun.x + a[1] * sun.y + a[2] * sun.z) / 6371;
  // Sentinel-2 cloudless is brighter than Blue Marble; 0.66 keeps the hand-over gentle
  const k = 0.66 * (globeUniforms.uFlood.value ? 1 : Math.min(1.12, 0.12 + 1.05 * Math.max(0, ndl)));
  for (const t of cache.values()) if (t.mesh) { t.mesh.material.opacity = Math.min(1, (now - t.born) / 1000) * fade; t.mesh.material.color.setScalar(k); }
}

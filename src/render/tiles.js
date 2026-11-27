// Close-up imagery streamed as Web-Mercator tiles when the camera is low over
// Pakistan and the nearby seas. Providers, keys and limits: src/config/imagery.js.
//
// Two tile layers: the satellite imagery and, above it, a transparent roads and
// place-names overlay (512 px tiles cover the area of a 256 px tile one zoom level
// lower, so they are requested one level up). Only tiles around the view load, at
// most 8 requests at once, cached in memory for the session. A coarser tile stays
// stretched under the view until the sharper one has faded in, so there are never
// blank squares. If a provider keeps failing (no key, bad key, offline) the next one
// takes over with the same fades; with none left the NASA globe simply stays.
//
// Tiles are curved patches on the sphere drawn right after the Earth with depth
// testing off (back faces culled), so the coarse globe never pokes through them.
import * as THREE from 'three';
import { latLonToEcef, gcDistance } from '../geo/globe.js';
import { PROVIDERS, FAIL_LIMIT, MAX_CONCURRENT, CACHE_TILES, MAX_DRAWN, START_KM, AREA } from '../config/imagery.js';
import { scene, renderer, camera } from './scene.js';
import { pose, altitudeKm, flightTarget } from './globecam.js';
import { globeUniforms } from './globe.js';
import { pakMask } from './pakmask.js';

// Small extra areas around the places abroad that have 3D models (onward.js: Marseille, Singapore …),
// so their close-ups are on satellite imagery too: ±2° around each.
const FADE_MS = 600; // each new tile fades in over this long
const extraAreas = [];
export const addImageryArea = (lat, lon) => extraAreas.push({ lat, lon });
const nearArea = (lat, lon) => extraAreas.some(a => Math.abs(lat - a.lat) < 2 && Math.abs(lon - a.lon) < 2 / Math.cos(a.lat * Math.PI / 180));
export const tileState = { enabled: true, active: false, busy: false, loaded: 0, failed: 0, online: true, provider: null, labels: null, credit: '', labelsCredit: '', poweredByEsri: false };
const lat2y = (lat, z) => (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** z;
const y2lat = (y, z) => { const n = Math.PI - 2 * Math.PI * y / 2 ** z; return 180 / Math.PI * Math.atan(Math.sinh(n)); };
const lon2x = (lon, z) => (lon + 180) / 360 * 2 ** z;
const x2lon = (x, z) => x / 2 ** z * 360 - 180;

// One shared request queue for both layers: at most MAX_CONCURRENT requests in flight.
// Brightness matching: imagery providers stitch different satellite sources at different zoom levels
// (Esri's sharpest Karachi photos are darker than the level above). Each new tile gets a gain so that
// its average brightness matches the same patch of ground in the coarser tile it replaces (0.6–1.8×).
const SAMP = 16, sampler = document.createElement('canvas'); sampler.width = sampler.height = SAMP;
const sctx = sampler.getContext('2d', { willReadFrequently: true });
function balance(t, img) {
  try { sctx.drawImage(img, 0, 0, SAMP, SAMP); } catch { return; }
  const d = sctx.getImageData(0, 0, SAMP, SAMP).data, lum = new Float32Array(SAMP * SAMP); let sum = 0;
  for (let i = 0; i < lum.length; i++) { lum[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]; sum += lum[i]; }
  t.lum = lum; t.gain = 1;
  for (let zz = t.z - 1, k = 1; zz >= Math.max(4, t.z - 6); zz--, k++) { // nearest loaded ancestor
    const a = t.layer.cache.get(`${t.src.id}/${zz}/${t.x >> k}/${t.y >> k}`); if (!a?.lum) continue;
    const n = 2 ** k, size = Math.max(1, SAMP / n), x0 = Math.floor(((t.x - (t.x >> k) * n) / n) * SAMP), y0 = Math.floor(((t.y - (t.y >> k) * n) / n) * SAMP);
    let s2 = 0, c = 0; for (let y = y0; y < y0 + size; y++) for (let x = x0; x < x0 + size; x++) { s2 += a.lum[y * SAMP + x]; c++; }
    t.gain = THREE.MathUtils.clamp((s2 / c) * (a.gain ?? 1) / Math.max(4, sum / lum.length), 0.6, 1.8);
    break;
  }
}

let inflight = 0; const queue = []; const cTmp = [0, 0, 0];
let pauseUntil = 0; // offline back-off: after repeated failures with no provider left, wait before retrying

// Shared uniforms: daylight to match the globe, and Pakistan's mask to darken the neighbours.
// uC: the view centre on the ground (ECEF km); each level's tiles fade out towards the edge of the area they cover
const shared = { uC: { value: new THREE.Vector3() }, uK: { value: 1 }, uFloor: { value: 0 }, uMask: pakMask.uniform, uDim: globeUniforms.uDim, uSun: globeUniforms.uSun, uFlood: globeUniforms.uFlood };
const imgVS = `attribute vec2 muv; varying vec2 vUv; varying vec2 vM; varying vec3 vN; varying vec3 vP; void main(){ vUv=uv; vM=muv; vP=position; vN=normalize((modelMatrix*vec4(position,1.)).xyz); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const imgFS = `uniform sampler2D map; uniform float uOpacity; uniform float uK; uniform float uFloor; uniform vec3 uSun; uniform float uFlood; uniform sampler2D uMask; uniform float uDim; uniform vec3 uC; uniform vec2 uFe; uniform float uGain; varying vec2 vUv; varying vec2 vM; varying vec3 vN; varying vec3 vP;
  void main(){ vec3 c = texture2D(map, vUv).rgb * uK * uGain;
    // the same day / night as the globe shader, per pixel from the real sun; a low 'dusk' floor close to the ground
    float ndl = dot(normalize(vN), uSun);
    vec3 lit = c * (0.12 + 1.05 * max(ndl, 0.0));
    vec3 night = c * max(0.025, uFloor);
    c = mix(mix(night, lit, smoothstep(-0.12, 0.18, ndl)), c, uFlood);
    // outside Pakistan: slightly darker and less colourful, so the country stands out
    float out_ = 1.0 - texture2D(uMask, vM).r; float g = dot(c, vec3(.299,.587,.114));
    c = mix(c, mix(vec3(g), c, .55) * .78, out_ * uDim);
    // a soft edge instead of a hard square where a sharper level ends (the coarser one is drawn underneath)
    gl_FragColor = vec4(c, uOpacity * (1.0 - smoothstep(uFe.x, uFe.y, distance(vP, uC))));
    #include <colorspace_fragment>
  }`;

class TileLayer {
  constructor(name, order, overlay) { this.name = name; this.order = order; this.overlay = overlay; this.cache = new Map(); this.group = new THREE.Group(); this.group.name = name; this.src = null; this.fails = 0; }
  setSource(src) { // switch provider: keep what's on screen until the new tiles fade in over it
    if (this.src === src) return; this.src = src; this.fails = 0;
    for (const t of this.cache.values()) { if (t.status === 'queued') { this.cache.delete(t.key); } else t.old = true; }
  }
  mesh(t, tex) {
    const S = t.z < 9 ? 12 : 6, pos = [], uv = [], muv = [], idx = [], a = [0, 0, 0];
    for (let j = 0; j <= S; j++) for (let i = 0; i <= S; i++) {
      const lat = y2lat(t.y + j / S, t.z), lon = x2lon(t.x + i / S, t.z); latLonToEcef(lat, lon, 0, a); pos.push(...a); uv.push(i / S, 1 - j / S); muv.push((lon + 180) / 360, (lat + 90) / 180);
    }
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const p = j * (S + 1) + i, q = p + S + 1; idx.push(p, q, p + 1, p + 1, q, q + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('muv', new THREE.Float32BufferAttribute(muv, 2)); g.setIndex(idx);
    const m = this.overlay
      ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false })
      : new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, uOpacity: { value: 0 }, uFe: { value: new THREE.Vector2(1e9, 2e9) }, uGain: { value: t.gain ?? 1 }, ...shared }, vertexShader: imgVS, fragmentShader: imgFS, transparent: true, depthTest: false, depthWrite: true });
    const mesh = new THREE.Mesh(g, m); mesh.renderOrder = this.order + t.z * 0.001; mesh.userData.key = t.key; g.computeBoundingSphere(); return mesh;
  }
  request(z, x, y) {
    const key = `${this.src.id}/${z}/${x}/${y}`; let t = this.cache.get(key);
    if (t) { t.used = performance.now(); return t; }
    t = { key, layer: this, src: this.src, z, x, y, status: 'queued', used: performance.now(), mesh: null, tex: null, born: 0 }; this.cache.set(key, t); queue.push(t); return t;
  }
  setOpacity(t, o) { if (this.overlay) t.mesh.material.opacity = o; else t.mesh.material.uniforms.uOpacity.value = o; }
  dispose(t) { if (t.mesh) { this.group.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.dispose(); } t.tex?.dispose(); this.cache.delete(t.key); }
  clear() { for (const t of [...this.cache.values()]) if (t.status !== 'loading') this.dispose(t); }

  // While the camera flies, ask early for the tiles the destination will need (its level and two above),
  // so they are already there when it lands. They are only fetched, not drawn, until the view wants them.
  prefetch(b, zImg) {
    const src = this.src; if (!src) return;
    const z = Math.max(4, Math.min(src.maxZoom, Math.round(zImg - Math.log2(src.tileSize / 256)))), ahead = this.ahead = new Set();
    for (const [zz, r] of [[z - 2, 1], [z, b.tilt > 50 ? 2 : 1]]) {
      if (zz < 4) continue; const cx = Math.floor(lon2x(b.lon, zz)), cy = Math.floor(lat2y(b.lat, zz));
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const y = cy + dy; if (y >= 0 && y < 2 ** zz) ahead.add(this.request(zz, (((cx + dx) % 2 ** zz) + 2 ** zz) % 2 ** zz, y).key); }
    }
  }
  // Choose and draw the tiles for the current view at imagery zoom zImg.
  update(zImg, now) {
    const src = this.src; if (!src) return;
    const off = Math.log2(src.tileSize / 256); // 512 px tiles: one level up
    const z = Math.max(4, Math.min(src.maxZoom, Math.round(zImg - off)));
    const want = this.want = new Set(), c = this.cache;
    const ring = (zz, r) => { const cx = Math.floor(lon2x(pose.lon, zz)), cy = Math.floor(lat2y(pose.lat, zz)); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = cx + dx, y = cy + dy; if (y < 0 || y >= 2 ** zz) continue; want.add(this.request(zz, ((x % 2 ** zz) + 2 ** zz) % 2 ** zz, y).key); } };
    const r = off ? 1 : 2, rt = pose.tilt > 50 ? r + 1 : r;
    if (z - 2 >= 4) ring(z - 2, 1); // backdrop: also covers the far part of tilted views
    ring(z, rt);
    // how far each level reaches from the centre (km): its edge is feathered from half that distance
    const kmAt = zz => 40075 * Math.cos(pose.lat * Math.PI / 180) / 2 ** zz, reach = zz => (zz === z ? rt : 2) * kmAt(zz);
    if (!this.overlay) latLonToEcef(pose.lat, pose.lon, 0, cTmp), shared.uC.value.fromArray(cTmp);
    // a tile entirely inside the unfeathered part of its level (only those may hide the level below)
    const solid = t => this.overlay || gcDistance(pose.lat, pose.lon, y2lat(t.y + 0.5, t.z), x2lon(t.x + 0.5, t.z)) + 0.75 * kmAt(t.z) < 0.5 * reach(t.z);
    for (const t of c.values()) if (t.status === 'failed' && t.httpStatus !== 404 && now - t.failedAt > 60000) { t.status = 'queued'; queue.push(t); }
    // forget queued requests the view no longer needs (a fast zoom would otherwise starve the fine tiles)
    for (let i = queue.length - 1; i >= 0; i--) { const t = queue[i]; if (t.layer === this && t.status === 'queued' && !want.has(t.key) && !this.ahead?.has(t.key)) { queue.splice(i, 1); c.delete(t.key); } }
    if (c.size > CACHE_TILES) {
      const nearCentre = t => Math.abs(t.x - Math.floor(lon2x(pose.lon, t.z))) <= 1 && Math.abs(t.y - Math.floor(lat2y(pose.lat, t.z))) <= 1 && t.z < z;
      [...c.values()].filter(t => !want.has(t.key) && !this.ahead?.has(t.key) && t.status !== 'loading' && !(t.status === 'ready' && nearCentre(t))).sort((a, b) => a.used - b.used).slice(0, c.size - CACHE_TILES).forEach(t => this.dispose(t));
    }
    // Draw the wanted tiles and coarse cover tiles near the centre; skip a tile whose four children are painted.
    const kids = t => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => c.get(`${t.src.id}/${t.z + 1}/${t.x * 2 + dx}/${t.y * 2 + dy}`));
    const painted = new Map();
    // coarser levels keep the whole view covered (radius 2) until finer tiles have painted over them
    const nearC = t => { const rr = 2; return Math.abs(t.x - Math.floor(lon2x(pose.lon, t.z))) <= rr && Math.abs(t.y - Math.floor(lat2y(pose.lat, t.z))) <= rr; };
    const drawable = t => want.has(t.key) || ((t.z < z || t.z === z + 1) && nearC(t)) || (!!t.old && nearC(t));
    // a hidden tile that is about to be shown again does not count as painted yet (it would fade in from zero over a hole)
    const isPainted = t => { if (!t || t.status !== 'ready' || now - t.born < FADE_MS + 50 || !solid(t)) return false; if (painted.has(t.key)) return painted.get(t.key); const p = kids(t).every(isPainted) || (drawable(t) && t.was !== false); painted.set(t.key, p); return p; };
    const shown = [];
    for (const t of c.values()) if (t.mesh) { t.was = t.mesh.visible; if (!this.overlay) t.mesh.material.uniforms.uFe.value.set(0.5 * reach(t.z), reach(t.z)); }
    for (const t of [...c.values()].sort((a, b) => b.z - a.z)) if (t.mesh) {
      // an old provider's tile stays only until the new provider has painted that spot
      const coveredByNew = t.old && [...want].some(k => { const n = c.get(k); return n && !n.old && n.status === 'ready' && now - n.born > FADE_MS + 50 && n.z >= t.z; });
      t.mesh.visible = !!(drawable(t) && !kids(t).every(isPainted) && !coveredByNew); // a real boolean: three.js draws anything that is not exactly false if (t.mesh.visible) shown.push(t);
    }
    const cap = this.overlay ? Math.round(MAX_DRAWN / 3) : MAX_DRAWN;
    if (shown.length > cap) {
      const d = t => Math.hypot(t.x + 0.5 - lon2x(pose.lon, t.z), t.y + 0.5 - lat2y(pose.lat, t.z));
      // keep the tiles the view asked for (sharpest first), then the coarsest cover; drop the finest cover first
      const capped = shown.sort((a, b) => want.has(b.key) - want.has(a.key) || (want.has(a.key) ? b.z - a.z : a.z - b.z) || d(a) - d(b)).slice(cap);
      // a capped tile is hidden only when its nearest loaded ancestor can take its place (no holes)
      for (const t of capped) for (let zz = t.z - 1, x = t.x >> 1, y = t.y >> 1; zz >= 4; zz--, x >>= 1, y >>= 1) { const a = c.get(`${t.src.id}/${zz}/${x}/${y}`); if (a?.mesh && now - a.born > FADE_MS + 50) { a.mesh.visible = true; t.mesh.visible = false; break; } }
    }
    for (const t of c.values()) if (t.mesh && t.mesh.visible && t.was === false && now - (t.seen || 0) > 1500) t.born = now; // comes into view: fade in from zero (its parent stays until it's opaque); a tile drawn a moment ago does not fade again
  }
}

const imagery = new TileLayer('imagery', -1.9, false), labels = new TileLayer('labels', -1.6, true);
let chain = PROVIDERS.filter(p => p.enabled), idx = 0;

function useProvider(i) {
  idx = i; const p = chain[i] || null;
  tileState.provider = p ? p.id : null; tileState.credit = p ? p.credit : ''; tileState.poweredByEsri = !!p?.poweredByEsri;
  imagery.setSource(p);
  const l = p?.labels && !p.labelsFailed ? p.labels : null; labels.setSource(l ? { ...l, id: p.id + '-labels' } : null);
  tileState.labels = l ? 'provider' : p?.id === 'maptiler' ? 'provider' : 'osm'; tileState.labelsCredit = l ? l.credit : '';
  if (!l) labels.clear();
  if (p?.metadata && !p.creditFetched) { p.creditFetched = true; fetchCredit(p.metadata).then(t => { if (t) { p.credit = t; if (chain[idx] === p) tileState.credit = t; } }); }
  if (l?.metadata && !l.creditFetched) { l.creditFetched = true; fetchCredit(l.metadata).then(t => { if (t) { l.credit = t; if (labels.src) tileState.labelsCredit = t; } }); }
}
// The credit text the service itself returns (it changes over time), without the leading "Source:".
async function fetchCredit(url) { try { const r = await fetch(url); if (!r.ok) return null; const j = await r.json(); return (j.copyrightText || j.copyright || '').replace(/^Source:\s*/i, '') || null; } catch { return null; } }

function failTile(t, status) {
  t.status = 'failed'; t.failedAt = performance.now(); t.httpStatus = status; tileState.failed++;
  if (status === 404) return; // no tile at this zoom here (e.g. Quetta z19): the coarser one stays stretched
  if (t.layer === labels) { const p = chain[idx]; if (p && ++labels.fails >= FAIL_LIMIT) { p.labelsFailed = true; useProvider(idx); } return; }
  if (++imagery.fails >= FAIL_LIMIT) {
    if (idx + 1 < chain.length) useProvider(idx + 1); // next provider, same fades
    else { tileState.online = false; pauseUntil = performance.now() + 30000; imagery.fails = 0; } // none left: the NASA globe stays; retry later
  }
}

function pump() {
  if (performance.now() < pauseUntil) return;
  while (inflight < MAX_CONCURRENT && queue.length) {
    const t = queue.shift(); if (t.status !== 'queued') continue;
    t.status = 'loading'; inflight++;
    fetch(t.src.url(t.z, t.x, t.y)).then(async r => {
      if (!r.ok) { inflight--; failTile(t, r.status); return; }
      let blob; try { blob = await r.blob(); } catch { inflight--; failTile(t, 0); return; } // connection dropped mid-download
      // decoded off the main thread (no hitch when a tile arrives); ImageBitmaps ignore flipY, so flip while decoding
      let img; try { img = await createImageBitmap(blob, { imageOrientation: 'flipY' }); } catch { inflight--; failTile(t, 0); return; }
      inflight--; tileState.online = true; t.layer.fails = 0;
      if (!t.layer.cache.has(t.key)) { img.close?.(); return; }
      if (!t.layer.overlay) balance(t, img);
      const tex = new THREE.Texture(img); tex.flipY = false; tex.needsUpdate = true; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      tex.minFilter = THREE.LinearMipmapLinearFilter; t.tex = tex; t.mesh = t.layer.mesh(t, tex); t.mesh.visible = false; /* the next pass decides (and keeps the draw cap) */ t.status = 'ready'; t.born = performance.now(); t.layer.group.add(t.mesh); tileState.loaded++;
    }, () => { inflight--; failTile(t, 0); });
  }
}

// Every frame: never more than the cap (+ a few cover tiles) on screen, whatever path the camera took.
// Tiles furthest from the view centre (measured in their own tile size) are hidden first.
const visibleList = [];
// Safety sweep: a mesh in the scene must belong to a tile in the cache; anything else is removed and freed.
function sweep(L) {
  for (let i = L.group.children.length - 1; i >= 0; i--) {
    const m = L.group.children[i], t = L.cache.get(m.userData.key);
    if (!t || t.mesh !== m) { L.group.remove(m); m.geometry.dispose(); m.material.dispose(); } // textures belong to the cache, which frees them
  }
}
// Only a tile whose area is already covered by a visible, fully faded-in ancestor may be hidden,
// so the limit never opens a hole (a hole shows the globe's night lights as a bright blur).
function enforceCap(L) {
  const limit = (L.overlay ? Math.round(MAX_DRAWN / 3) : MAX_DRAWN) + 6, now = performance.now();
  visibleList.length = 0; for (const t of L.cache.values()) if (t.mesh?.visible) visibleList.push(t);
  if (visibleList.length <= limit) return;
  const covered = t => { for (let zz = t.z - 1, x = t.x >> 1, y = t.y >> 1; zz >= 4; zz--, x >>= 1, y >>= 1) { const a = L.cache.get(`${t.src.id}/${zz}/${x}/${y}`); if (a?.mesh?.visible && now - a.born > FADE_MS + 50) return true; } return false; };
  const d = t => Math.hypot(t.x + 0.5 - lon2x(pose.lon, t.z), t.y + 0.5 - lat2y(pose.lat, t.z));
  // cover tiles the view did not ask for go first, finest and furthest first
  let n = visibleList.length;
  for (const t of visibleList.sort((a, b) => !!L.want?.has(a.key) - !!L.want?.has(b.key) || b.z - a.z || d(b) - d(a))) { if (n <= limit) break; if (covered(t)) { t.mesh.visible = false; n--; } }
}

export function initTiles() { scene.add(imagery.group, labels.group); useProvider(0); }
export function tileDebug() { const by = {}; for (const t of imagery.cache.values()) if (t.mesh?.visible) { const b = by[t.z] ||= [0, 0, 0]; b[0]++; b[1] += t.mesh.material.uniforms.uOpacity.value; b[2] += t.gain ?? 1; } return Object.entries(by).map(([z, [n, o, g]]) => `${z}:${n}@${(o / n).toFixed(2)}${Math.abs(g / n - 1) > 0.01 ? '×' + (g / n).toFixed(2) : ''}`).join(' ') + ` src=${tileState.provider} labels=${tileState.labels}` + strays(); }
function strays() { const o = imagery.group.children.filter(m => m.visible && imagery.cache.get(m.userData.key)?.mesh !== m); return o.length ? ` strays=${o.length}:${o.slice(0, 3).map(m => m.userData.key + (imagery.cache.has(m.userData.key) ? '(other)' : '(gone)')).join(',')}` : ''; }

let last = 0;
export function updateTiles() {
  const now = performance.now();
  const inArea = (pose.lat > AREA.lat0 && pose.lat < AREA.lat1 && pose.lon > AREA.lon0 && pose.lon < AREA.lon1) || nearArea(pose.lat, pose.lon);
  const active = tileState.enabled && !!chain[idx] && inArea && altitudeKm < START_KM;
  tileState.active = active; tileState.busy = active && inflight + queue.length > 0; // the loading spinner
  // cross-fade from the NASA globe, driven by camera height (no sudden switch)
  const fade = active ? 1 - THREE.MathUtils.smoothstep(altitudeKm, START_KM * 0.45, START_KM) : 0;
  tileState.fade = fade;
  const b = flightTarget(), bKm = b && 2 * b.range * Math.tan(camera.fov * Math.PI / 360) / innerHeight;
  const ahead = b && !tileState.noPrefetch && tileState.enabled && !!chain[idx] && b.range < START_KM * 0.45 && ((b.lat > AREA.lat0 && b.lat < AREA.lat1 && b.lon > AREA.lon0 && b.lon < AREA.lon1) || nearArea(b.lat, b.lon));
  if (!ahead) imagery.ahead = labels.ahead = null;
  if ((active || ahead) && now - last > 200) {
    last = now;
    if (ahead) { const zb = Math.log2(40075 * Math.cos(b.lat * Math.PI / 180) / (256 * Math.max(1e-4, bKm))); imagery.prefetch(b, zb); if (labels.src && b.range < 250) labels.prefetch(b, zb); }
    if (active) {
      const kmPerPx = 2 * pose.range * Math.tan(camera.fov * Math.PI / 360) / innerHeight;
      const zImg = Math.log2(40075 * Math.cos(pose.lat * Math.PI / 180) / (256 * Math.max(1e-4, kmPerPx)));
      imagery.update(zImg, now); if (labels.src) labels.update(zImg, now);
    }
    // the destination's tiles first while flying (the views passed on the way are gone in a moment), then imagery, coarse first
    const early = t => !!t.layer.ahead?.has(t.key);
    queue.sort((a, b) => early(b) - early(a) || (a.layer === labels) - (b.layer === labels) || a.z - b.z);
    pump();
  }
  if (!active && now - last > 8000 && (imagery.cache.size || labels.cache.size)) { imagery.clear(); labels.clear(); last = now; }
  shared.uK.value = 0.64; // satellite photos are brighter than Blue Marble: this matches them, so the hand-over is invisible
  // night: a low 'dusk' light builds up evenly (in log height) from 2,500 km down to 30 km, so roads stay readable close up
  shared.uFloor.value = 0.24 * (1 - THREE.MathUtils.smoothstep(Math.log(Math.max(1, altitudeKm)), Math.log(30), Math.log(2500)));
  for (const L of [imagery, labels]) {
    L.group.visible = fade > 0.01;
    sweep(L); // every frame: cheap, and nothing orphaned is ever drawn
    enforceCap(L);
    // labels fade in a little later than the imagery, once there's something to read (≈ below 250 km)
    const lf = L === labels ? fade * (1 - THREE.MathUtils.smoothstep(altitudeKm, 120, 250)) : fade;
    for (const t of L.cache.values()) if (t.mesh) { L.setOpacity(t, Math.min(1, (now - t.born) / FADE_MS) * lf); if (t.mesh.visible) t.seen = now; }
  }
}

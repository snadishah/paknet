// Cables close to the ground (docs/ROUND2.md item 9). Below ~15 km the fibre routes become things in the
// landscape: buried fibre is a strip of back-filled trench beside the road (at least ~2.5 px wide so it
// reads from the air), with orange route-marker posts every 100 m once you are low enough to see them;
// aerial fibre hangs from wooden poles every 50 m, sagging between them. Only the stretch around the view
// is built (rebuilt when the view moves on): three draw calls at most. The screen-width network lines stay.
import * as THREE from 'three';
import { scene, camera } from './scene.js';
import { pose, altitudeKm } from './globecam.js';
import { edgeGlobe } from './geo3.js';
import { latLonToEcef } from '../geo/globe.js';

const SHOW_KM = 15, POSTS_KM = 1.2;
let edges = [], group = null, builtAt = null, builtW = 0, builtPosts = false;
const centre = new THREE.Vector3();

export function initGroundCables(G) { edges = G.edges.filter(e => ['fiber', 'xborder', 'aerial', 'access'].includes(e.type) && !e.office); }

function post() { // a concrete marker post with an orange cap (metres, z up), vertex-coloured
  const a = new THREE.BoxGeometry(0.16, 0.16, 1.0).translate(0, 0, 0.5), b = new THREE.BoxGeometry(0.22, 0.22, 0.16).translate(0, 0, 1.08);
  return merge([[a, 0xe8e6e0], [b, 0xff7a1a]]);
}
function pole() { // a wooden pole with a cross-arm
  const a = new THREE.CylinderGeometry(0.11, 0.14, 8, 6).rotateX(Math.PI / 2).translate(0, 0, 4), b = new THREE.BoxGeometry(1.4, 0.1, 0.1).translate(0, 0, 7.4);
  return merge([[a, 0x6b5440], [b, 0x5a4636]]);
}
function merge(parts) {
  const geos = parts.map(([g, hex]) => { if (g.index) g = g.toNonIndexed(); g.deleteAttribute('uv'); const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; });
  const out = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'color']) { const arr = geos.map(g => g.attributes[k].array), z = new Float32Array(arr.reduce((s, x) => s + x.length, 0)); let o = 0; for (const x of arr) { z.set(x, o); o += x.length; } out.setAttribute(k, new THREE.BufferAttribute(z, 3)); }
  return out;
}

// a point a fraction f of the way from a to b, back on the ground (not on the chord), lifted by lift km
const onGround = (a, b, f, lift = 0.0004) => a.clone().lerp(b, f).setLength(a.length() + (b.length() - a.length()) * f + lift);

function free() { if (!group) return; scene.remove(group); group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); group = null; }

function build(R, wKm, posts) {
  free(); group = new THREE.Group(); group.renderOrder = 3;
  const strip = [], marks = [], poles = [], wires = [], up = new THREE.Vector3(), side = new THREE.Vector3(), d = new THREE.Vector3();
  for (const e of edges) {
    const p = edgeGlobe(e), aerial = e.type === 'aerial', step = aerial ? 0.05 : 0.1; let carry = 0, last = null;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i]; if (a.distanceTo(centre) > R && b.distanceTo(centre) > R) { carry = 0; last = null; continue; }
      const L = a.distanceTo(b); d.subVectors(b, a).normalize(); up.copy(a).normalize(); side.crossVectors(d, up).normalize();
      if (!aerial) { // the trench: a strip 3 m to the side of the road's centre line, just above the ground, in ≤ 200 m pieces (it follows the curve)
        const o = side.clone().multiplyScalar(0.003), h = side.clone().multiplyScalar(wKm / 2), n = Math.max(1, Math.ceil(L / 0.2));
        for (let k = 0; k < n; k++) {
          const A = onGround(a, b, k / n).add(o), B = onGround(a, b, (k + 1) / n).add(o);
          strip.push(A.clone().sub(h), A.clone().add(h), B.clone().add(h), A.clone().sub(h), B.clone().add(h), B.clone().sub(h));
        }
      }
      if (!posts && !aerial) continue;
      for (let t = step - carry; t < L; t += step) { // posts / poles at a steady spacing along the route
        const q = onGround(a, b, t / L, 0).addScaledVector(side, 0.003);
        if (aerial) { poles.push(q.clone()); if (last) wires.push([last, q.clone()]); last = q.clone(); } else marks.push(q);
      }
      carry = (carry + L) % step;
    }
  }
  if (strip.length) {
    const g = new THREE.BufferGeometry().setFromPoints(strip); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x3a2e25, roughness: 1, transparent: true, opacity: 0.9, depthWrite: false }));
    m.renderOrder = 3; group.add(m);
  }
  const inst = (geo, list, k = 1) => {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), list.length), o = new THREE.Object3D(), z = new THREE.Vector3(0, 0, 1);
    list.forEach((q, i) => { o.position.copy(q); o.quaternion.setFromUnitVectors(z, q.clone().normalize()); o.scale.setScalar(0.001 * k); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    group.add(m); // no shadows: a 1 m post's would be invisible, and instanced casters threw wrong, huge ones on the catcher
  };
  if (marks.length) inst(post(), marks, THREE.MathUtils.clamp(wKm / 0.0012 * 0.8, 1, 2.5)); // a little larger when they would be only a few px tall
  if (poles.length) {
    inst(pole(), poles);
    // the cable sags ~0.6 m between poles, hung 7.3 m up
    const pts = []; for (const [a, b] of wires) { let prev = null; for (let k = 0; k <= 6; k++) { const f = k / 6, q = a.clone().lerp(b, f); q.setLength(q.length() + 0.0073 - 0.0006 * 4 * f * (1 - f)); if (prev) pts.push(prev, q); prev = q; } }
    group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x1d1f22 })));
  }
  scene.add(group);
}

export function updateGroundCables() {
  const alt = altitudeKm;
  if (alt > SHOW_KM) { if (group) { free(); builtAt = null; } return; }
  centre.fromArray(latLonToEcef(pose.lat, pose.lon, 0));
  const R = THREE.MathUtils.clamp(alt * 2, 1.5, 20), kmPerPx = 2 * pose.range * Math.tan(camera.fov * Math.PI / 360) / innerHeight;
  const w = Math.max(0.0012, 2.5 * kmPerPx), posts = alt < POSTS_KM;
  // rebuild when the view has moved a third of the way out, or the strip width / posts would change a lot
  if (!builtAt || builtAt.distanceTo(centre) > R / 3 || w / builtW > 1.6 || builtW / w > 1.6 || posts !== builtPosts) { build(R, w, posts); builtAt = centre.clone(); builtW = w; builtPosts = posts; }
}

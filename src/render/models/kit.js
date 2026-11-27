// A small kit for building detailed models in code (no downloads, no licences).
// Parts are added in a local East-North-Up frame in metres (x east, y north, z up, ground at z = 0),
// each with a colour and a surface: matte (concrete, paint), metal, glass, light (self-lit, e.g.
// LEDs and lamps) or thin (open shells seen from both sides, e.g. dishes). build() merges each surface
// into one mesh, so a whole model is ≤ 5 draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const SURFACES = {
  matte: () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.04, envMapIntensity: 0.4 }),
  metal: () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.8, envMapIntensity: 0.8 }),
  glass: () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.9, envMapIntensity: 1.4 }),
  light: () => new THREE.MeshBasicMaterial({ vertexColors: true }),
  thin: () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15, envMapIntensity: 0.5, side: THREE.DoubleSide }) // open shells: dishes
};
const c3 = new THREE.Color();

export class Kit {
  constructor() { this.parts = { matte: [], metal: [], glass: [], light: [], thin: [] }; }
  // any geometry, in metres, already placed
  add(g, color, surf = 'matte') {
    g.deleteAttribute('uv'); if (g.index) g = g.toNonIndexed();
    c3.set(color); const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c3.r; a[i * 3 + 1] = c3.g; a[i * 3 + 2] = c3.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); this.parts[surf].push(g); return this;
  }
  // a box standing on z (w along x, d along y, h up), turned by rot (radians) about its own centre
  box(w, d, h, x, y, z, color, surf, rot = 0) { const g = new THREE.BoxGeometry(w, d, h).translate(0, 0, h / 2); if (rot) g.rotateZ(rot); return this.add(g.translate(x, y, z), color, surf); }
  // an upright cylinder (or cone when rTop differs)
  cyl(r, h, x, y, z, color, surf, seg = 16, rTop = r) { return this.add(new THREE.CylinderGeometry(rTop, r, h, seg).rotateX(Math.PI / 2).translate(x, y, z + h / 2), color, surf); }
  // a lying cylinder (tank, pipe) of length len along direction rot (0 = east), resting on z
  tube(r, len, x, y, z, color, surf, rot = 0, seg = 12) { return this.add(new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2 + rot).translate(x, y, z + r), color, surf); }
  // a thin bar from a to b ([x, y, z] in metres), square section s
  bar(a, b, s, color, surf = 'metal') {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B); if (L < 1e-6) return this;
    const g = new THREE.BoxGeometry(s, s, L); g.lookAt(B.clone().sub(A)); return this.add(g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2), color, surf);
  }
  // a parabolic dish of radius r with its rim centre at (x, y, z), facing azimuth az / elevation el (degrees)
  dish(r, x, y, z, az, el, color = 0xe9edf0) {
    const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(r * t, r * 0.35 * t * t)); }
    const g = new THREE.LatheGeometry(pts, 20).rotateX(Math.PI / 2); // opens towards +z
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirOf(az, el));
    this.add(g.applyQuaternion(q).translate(x, y, z), color, 'thin'); // seen from both sides
    // feed horn on a short boom
    const f = dirOf(az, el).multiplyScalar(r * 0.75); return this.bar([x, y, z], [x + f.x, y + f.y, z + f.z], r * 0.05, 0x9aa3a8);
  }
  build() {
    const g = new THREE.Group();
    for (const [k, list] of Object.entries(this.parts)) {
      if (!list.length) continue;
      const geo = mergeGeometries(list); list.forEach(x => x.dispose());
      const m = new THREE.Mesh(geo, SURFACES[k]()); m.userData.surface = k; g.add(m);
    }
    return g;
  }
}
// unit vector for an azimuth (degrees from north, clockwise) and elevation (degrees above the horizon)
export function dirOf(az, el) { const a = az * Math.PI / 180, e = el * Math.PI / 180; return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)); }

// Shared small props
export function fence(k, w, d, x, y, gate = 8, color = 0x8d969b) { // chain-link: posts every 4 m and a top rail, gap on the south side
  const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay), n = Math.ceil(L / 4);
    for (let s = 0; s <= n; s++) { const t = s / n, px = ax + (bx - ax) * t, py = ay + (by - ay) * t; if (i === 1 && Math.abs(px) < gate / 2) continue; k.box(0.12, 0.12, 2.4, x + px, y + py, 0, color, 'metal'); }
    if (i === 1) { k.bar([x + ax, y + ay, 2.3], [x - gate / 2, y + ay, 2.3], 0.06, color); k.bar([x + gate / 2, y + ay, 2.3], [x + bx, y + by, 2.3], 0.06, color); }
    else k.bar([x + ax, y + ay, 2.3], [x + bx, y + by, 2.3], 0.06, color);
  }
  return k;
}
export function generator(k, x, y, rot = 0) { // a containerised diesel generator with exhaust stack
  k.box(6, 2.4, 2.6, x, y, 0, 0x5f6b5a, 'matte', rot).box(6.1, 2.5, 0.12, x, y, 2.6, 0x4b5547, 'metal', rot);
  const c = Math.cos(rot), s = Math.sin(rot);
  return k.cyl(0.18, 1.6, x + 2.2 * c, y + 2.2 * s, 2.7, 0x3a3d40, 'metal', 8);
}
export function chillers(k, x, y, z, n, rot = 0) { // a row of rooftop chillers with fan rings
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) { const px = x + (i - (n - 1) / 2) * 3.4 * c, py = y + (i - (n - 1) / 2) * 3.4 * s; k.box(3, 2.4, 1.6, px, py, z, 0xc9ced1, 'metal', rot).cyl(0.9, 0.12, px, py, z + 1.6, 0x2c3236, 'metal', 14); }
  return k;
}
export function tree(k, x, y, h = 6) { k.cyl(0.18, h * 0.45, x, y, 0, 0x6b5440, 'matte', 6); return k.add(new THREE.IcosahedronGeometry(h * 0.32, 0).translate(x, y, h * 0.65), 0x4f6b3a, 'matte'); }
export function car(k, x, y, rot, color) { k.box(4.3, 1.8, 0.75, x, y, 0.25, color, 'metal', rot); return k.box(2.2, 1.6, 0.6, x, y, 1.0, 0x26303a, 'glass', rot); }
export function lamp(k, x, y, h = 7) { k.cyl(0.08, h, x, y, 0, 0x7d868b, 'metal', 6); return k.box(0.9, 0.3, 0.15, x + 0.4, y, h, 0xfff3d6, 'light'); }

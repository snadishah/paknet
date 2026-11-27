// Street life around each office (docs/ROUND2.md item 13): the city's OpenStreetMap streets
// (scripts/fetch-streets.mjs) lined with trees, street lamps on the main roads and cars parked along the
// kerbs or moving on the main roads. Placed by fixed rules with a seeded shuffle (the same every visit),
// never inside a building's footprint or a model's plot. Three instanced meshes per city, in the city's
// local frame (metres east / north of the office), faded with the buildings by city.js.
import * as THREE from 'three';

const TREE = [0x4f6b3a, 0x5d7a3f, 0x45603a, 0x6b7d45], CARS = [0xb8c0c6, 0x2b3a52, 0xd9d6cf, 0x8b1e1e, 0x55606b, 0xeaeaea, 0x1f2326, 0xc9b27a];
const MAX = { tree: 1500, lamp: 400, car: 600 };

function coloured(parts) { // [[geometry, hex], …] → one vertex-coloured geometry (metres, z up)
  const geos = parts.map(([g, hex]) => { g = g.toNonIndexed(); g.deleteAttribute('uv'); const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; });
  const out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'color']) { const arr = geos.map(g => g.attributes[k].array), z = new Float32Array(arr.reduce((s, x) => s + x.length, 0)); let o = 0; for (const x of arr) { z.set(x, o); o += x.length; } out.setAttribute(k, new THREE.BufferAttribute(z, 3)); }
  return out;
}
const up = g => g.rotateX(Math.PI / 2); // three's cylinders stand on y; ours on z
const treeGeo = () => coloured([[up(new THREE.CylinderGeometry(0.14, 0.2, 2.8, 6)).translate(0, 0, 1.4), 0x6b5440], [new THREE.IcosahedronGeometry(2.1, 0).scale(1, 1, 0.85).translate(0, 0, 4.2), 0xffffff]]); // crown tinted per tree
const lampGeo = () => coloured([[up(new THREE.CylinderGeometry(0.07, 0.1, 8, 6)).translate(0, 0, 4), 0x7d868b], [new THREE.BoxGeometry(1.6, 0.08, 0.08).translate(0.8, 0, 7.9), 0x7d868b], [new THREE.BoxGeometry(0.6, 0.25, 0.12).translate(1.5, 0, 7.8), 0xfff3d6]]);
const carGeo = () => coloured([[new THREE.BoxGeometry(4.3, 1.8, 0.75).translate(0, 0, 0.62), 0xffffff], [new THREE.BoxGeometry(2.2, 1.6, 0.6).translate(-0.2, 0, 1.3), 0x30363c]]); // body tinted per car

// a seeded random number in [0, 1) for each placement, so the street looks the same every visit
const rnd = (i, j) => { const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); };

// streets: { s: [[kind, x, y, x, y …] …] }; free(x, y): the spot is not inside a building or a model's plot
export function streetProps(streets, free) {
  const put = { tree: [], lamp: [], car: [] };
  const add = (k, x, y, rot, col) => { if (put[k].length < MAX[k] && free(x, y, k === 'car' ? 1.2 : 2)) put[k].push([x, y, rot, col]); };
  streets.s.forEach((row, si) => {
    const kind = row[0]; let carry = 0, n = 0;
    for (let i = 3; i < row.length; i += 2) {
      const ax = row[i - 2], ay = row[i - 1], bx = row[i], by = row[i + 1], L = Math.hypot(bx - ax, by - ay); if (L < 0.5) continue;
      const dx = (bx - ax) / L, dy = (by - ay) / L, sx = -dy, sy = dx, rot = Math.atan2(dy, dx), step = 6;
      for (let t = step - carry; t < L; t += step, n++) {
        const x = ax + dx * t, y = ay + dy * t, r = rnd(si, n);
        if (kind === 0) { // main road: trees both sides every 18 m, a lamp every 36 m, some cars in the lanes
          if (n % 3 === 0) { add('tree', x + sx * 10, y + sy * 10, 0, TREE[n % 4]); add('tree', x - sx * 10, y - sy * 10, 0, TREE[(n + 1) % 4]); }
          if (n % 6 === 0) add('lamp', x + sx * (n % 12 ? 7.5 : -7.5) , y + sy * (n % 12 ? 7.5 : -7.5), rot + (n % 12 ? -Math.PI / 2 : Math.PI / 2));
          if (n % 2 === 0 && r < 0.3) { const s = r < 0.15 ? 1 : -1; add('car', x + sx * 2.2 * s, y + sy * 2.2 * s, rot + (s < 0 ? Math.PI : 0), CARS[(n + si) % CARS.length]); }
        } else if (kind === 1) { // street: trees on both sides every 18 m (not every gap), cars parked along the kerb
          if (n % 3 === 0 && r < 0.65) { add('tree', x + sx * 6, y + sy * 6, 0, TREE[n % 4]); add('tree', x - sx * 6, y - sy * 6, 0, TREE[(n + 2) % 4]); }
          if (r > 0.62) add('car', x + sx * 3.4, y + sy * 3.4, rot, CARS[(n * 3 + si) % CARS.length]);
        } else if (r > 0.8) add('car', x + sx * 2.4, y + sy * 2.4, rot, CARS[(n + si * 5) % CARS.length]); // lane: the odd parked car
      }
      carry = (carry + L) % step;
    }
  });
  const g = new THREE.Group(), o = new THREE.Object3D(), c = new THREE.Color();
  for (const [k, geo] of [['tree', treeGeo()], ['lamp', lampGeo()], ['car', carGeo()]]) {
    const list = put[k]; if (!list.length) { geo.dispose(); continue; }
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: k === 'car' ? 0.4 : 0.85, metalness: k === 'car' ? 0.5 : 0.05, transparent: true }), list.length);
    list.forEach(([x, y, rot, col], i) => {
      o.position.set(x, y, 0); o.rotation.set(0, 0, rot); const s = k === 'tree' ? 0.8 + rnd(x, y) * 0.5 : 1; o.scale.set(s, s, s); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(col ?? 0xffffff));
    });
    m.renderOrder = 2; g.add(m);
  }
  return g;
}

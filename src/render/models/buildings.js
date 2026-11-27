// Representative 3D models of the network's buildings, built in code (docs/ROUND2.md §3).
// Each function returns a Kit (local ENU metres); landmarks.js turns it into a mesh group.
import { Kit, fence, generator, chillers, tree, car, lamp, dirOf } from './kit.js';

const GRAVEL = 0x6f6c66, CONCRETE = 0xd9d4c8, PLASTER = 0xe6dfd0, ROOF = 0x9aa0a3, ASPHALT = 0x3b3e42, STEEL = 0xb7bfc4, DARK = 0x2a2f35;

// Submarine cable landing station: a low secure building inside a fence, generators, a fuel tank,
// the beach manhole, and the cable trench running to the water (seaward = direction of the sea, radians from east).
export function landingStation({ seaward = -Math.PI / 2, variant = 0 } = {}) {
  const k = new Kit(), c = Math.cos(seaward), s = Math.sin(seaward);
  k.box(70, 54, 0.15, 0, 0, 0, GRAVEL); // yard
  k.box(34, 20, 7, -6, 6, 0, variant % 2 ? PLASTER : CONCRETE).box(34.4, 20.4, 0.6, -6, 6, 7, ROOF); // main hall + parapet
  k.box(12, 9, 4.5, 16, 12, 0, CONCRETE).box(6, 0.3, 3.2, -6, -4.2, 0, DARK); // power room, loading door
  for (let i = 0; i < 6; i++) k.box(1.6, 0.2, 1, -18 + i * 5, -4.1, 4.2, 0x3a4a58, 'glass'); // high windows
  chillers(k, -6, 10, 7.6, 4);
  generator(k, 14, -12); generator(k, 14, -17);
  k.tube(1.4, 9, -20, -16, 0, 0xe8e4da, 'metal').box(9.5, 0.3, 0.6, -20, -16, 0, 0x7d7a73); // fuel tank on its plinth
  fence(k, 70, 54, 0, 0, 9);
  k.box(3.2, 2.6, 2.8, 5, -28.5, 0, PLASTER).box(3.4, 2.8, 0.2, 5, -28.5, 2.8, ROOF); // guard hut at the gate
  k.box(9, 0.25, 0.25, 0, -27, 1.0, 0xd9452f, 'metal'); // barrier arm
  // beach manhole and the trench to the sea
  const mx = 30 * c, my = 30 * s; k.box(3, 3, 0.35, mx, my, 0, 0x6f6c66).box(2.2, 2.2, 0.05, mx, my, 0.35, 0x45474a, 'metal');
  for (let i = 0; i < 12; i++) { const d = 34 + i * 7; k.box(7.2, 1.4, 0.12, d * c, d * s, 0, 0x5d5a55, 'matte', seaward); }
  lamp(k, -30, -24); lamp(k, 30, -24); lamp(k, -30, 24); lamp(k, 30, 24);
  return k;
}

// Data centre / internet exchange: windowless block, loading bay, rooftop chillers, generator yard,
// fuel tanks, fence, car park. size 1 = an IXP suite building, 1.6 = a large data centre.
export function dataCentre({ size = 1, sign = 0x2f6f53 } = {}) {
  const k = new Kit(), w = 46 * size, d = 32 * size, h = 13;
  k.box(w + 40, d + 46, 0.15, 0, 0, 0, GRAVEL); // site
  k.box(w, d, h, 0, 0, 0, 0xc9cdd0).box(w + 0.4, d + 0.4, 0.8, 0, 0, h, 0xa3a9ad); // hall, parapet
  for (let i = 0; i < Math.round(w / 6); i++) k.box(0.25, 0.3, h - 1, -w / 2 + 3 + i * 6, -d / 2 - 0.1, 0, 0xb5babe); // façade ribs
  k.box(10, 0.3, 4.5, w / 4, -d / 2 - 0.1, 0, DARK).box(12, 5, 0.3, w / 4, -d / 2 - 2.6, 4.6, STEEL, 'metal'); // loading bay + canopy
  k.box(6, 0.25, 3, -w / 4, -d / 2 - 0.15, 0, 0x22303a, 'glass').box(7, 0.2, 0.9, -w / 4, -d / 2 - 0.2, 3.4, sign, 'light'); // entrance, sign
  chillers(k, 0, d / 4, h + 0.8, Math.round(w / 4)); chillers(k, 0, -d / 4, h + 0.8, Math.round(w / 4));
  for (let i = 0; i < Math.round(2 * size + 1); i++) generator(k, w / 2 + 9, -d / 2 + 4 + i * 5, Math.PI / 2);
  k.tube(1.3, 8, w / 2 + 9, d / 2 + 4, 0, 0xe8e4da, 'metal', Math.PI / 2).tube(1.3, 8, w / 2 + 13, d / 2 + 4, 0, 0xe8e4da, 'metal', Math.PI / 2);
  fence(k, w + 38, d + 44, 0, 0, 10);
  const cols = [0xb8c0c6, 0x2b3a52, 0xd9d6cf, 0x8b1e1e, 0x55606b];
  for (let i = 0; i < 8; i++) car(k, -w / 2 + 4 + i * 3, -d / 2 - 14, Math.PI / 2, cols[i % cols.length]);
  lamp(k, -w / 2 - 6, -d / 2 - 10); lamp(k, w / 2 + 2, -d / 2 - 10);
  return k;
}

// City telephone exchange (core router site): a 5-storey block with window bands and a rooftop mast with panels and dishes.
export function exchange() {
  const k = new Kit(), w = 30, d = 22, floors = 5, fh = 3.6;
  k.box(w + 16, d + 16, 0.15, 0, 0, 0, GRAVEL);
  k.box(w, d, floors * fh, 0, 0, 0, PLASTER).box(w + 0.4, d + 0.4, 0.7, 0, 0, floors * fh, ROOF);
  for (let f = 0; f < floors; f++) { k.box(w + 0.1, d + 0.1, 1.3, 0, 0, f * fh + 1.1, 0x34414d, 'glass'); }
  for (let i = 0; i < 8; i++) k.box(0.5, d + 0.3, floors * fh, -w / 2 + 2 + i * (w - 4) / 7, 0, 0, PLASTER); // mullions
  const top = floors * fh + 0.7;
  k.box(6, 6, 3, w / 4, 0, top, CONCRETE); // stair / equipment room
  const mx = -w / 4, H = 24; // lattice mast
  for (const [ax, ay] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.bar([mx + ax * 1.5, ay * 1.5, top], [mx + ax * 0.5, ay * 0.5, top + H], 0.18, 0xc7ccd0);
  for (let z = 0; z < H; z += 3) { const r = 1.5 - (z / H); k.bar([mx - r, -r, top + z], [mx + r, r, top + z + 3], 0.08, 0xc7ccd0).bar([mx + r, -r, top + z], [mx - r, r, top + z + 3], 0.08, 0xc7ccd0); }
  for (let i = 0; i < 3; i++) { const a = i * 2.094; k.box(0.4, 1.4, 2.4, mx + Math.cos(a) * 1.1, Math.sin(a) * 1.1, top + H - 4, 0xeef0f2, 'matte', a); } // sector panels
  k.dish(1.1, mx + 1.2, 0.8, top + H - 9, 60, 2).dish(1.1, mx - 1.2, -0.8, top + H - 11, 230, 1);
  k.box(0.3, 0.3, 0.3, mx, 0, top + H + 0.3, 0xff3b30, 'light'); // aircraft warning light
  return k;
}

// Satellite ground station: three big dishes on pedestals aimed at the satellite (az / el in degrees) and a control building.
export function groundStation({ az = 230, el = 50 } = {}) {
  const k = new Kit();
  k.box(110, 70, 0.15, 0, 0, 0, GRAVEL);
  k.box(24, 14, 6, -38, -18, 0, PLASTER).box(24.4, 14.4, 0.5, -38, -18, 6, ROOF);
  for (let i = 0; i < 3; i++) {
    const x = -10 + i * 26, y = 10, r = 6.5 - i * 0.8; // 13 m, 11.4 m, 9.8 m dishes
    k.cyl(1.6, 5, x, y, 0, CONCRETE, 'matte', 12).box(3, 3, 1.2, x, y, 5, STEEL, 'metal'); // pedestal + mount
    const hub = dirOf(az, el).multiplyScalar(-0.5); k.dish(r, x + hub.x, y + hub.y, 7 + r * 0.55 + hub.z, az, el);
  }
  fence(k, 110, 70, 0, 0, 10); lamp(k, -50, -30); lamp(k, 50, -30);
  return k;
}

// Illustrative office (one per city): glass curtain wall over 7 floors, lobby, rooftop units and antenna,
// car park, trees, lamps, a sign; the ground-floor corner is cut away to show the network room and its router rack.
// Returns the kit and the LED positions (driven by the office's traffic in landmarks.js).
export function office({ name = 'Office' } = {}) {
  const k = new Kit(), w = 26, d = 18, floors = 7, fh = 3.5, H = floors * fh;
  k.box(w + 34, d + 40, 0.15, 0, 0, 0, GRAVEL);
  // tower: glass with floor slabs; the south-west ground-floor corner (8 × 6 m) is open
  for (let f = 1; f < floors; f++) k.box(w, d, fh - 0.45, 0, 0, f * fh + 0.45, 0x3d5a73, 'glass').box(w + 0.3, d + 0.3, 0.45, 0, 0, f * fh, 0xe4e6e7);
  k.box(w - 8, d, fh - 0.45, 4, 0, 0.45, 0x3d5a73, 'glass').box(8, d - 6, fh - 0.45, -w / 2 + 4, 3, 0.45, 0x3d5a73, 'glass');
  k.box(w + 0.3, d + 0.3, 0.45, 0, 0, 0, 0xe4e6e7).box(w + 0.6, d + 0.6, 0.8, 0, 0, H, 0xd4d7d9);
  for (const [x, y] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]) k.box(0.6, 0.6, H, x, y, 0, 0xe4e6e7); // corner columns
  // the network room inside the cut-away corner: floor, two walls, a rack with patch panels, cable tray
  const rx = -w / 2 + 4, ry = -d / 2 + 3;
  k.box(8, 6, 0.1, rx, ry, 0.45, 0xb9bec1).box(0.2, 6, fh - 0.5, rx + 4, ry, 0.45, 0xf2f2ef).box(8, 0.2, fh - 0.5, rx, ry + 3, 0.45, 0xf2f2ef);
  k.box(0.9, 1.1, 2.1, rx + 2.6, ry + 1.8, 0.55, 0x1c2024, 'metal').box(0.9, 1.1, 2.1, rx + 1.4, ry + 1.8, 0.55, 0x1c2024, 'metal');
  k.box(6, 0.3, 0.12, rx, ry + 2.6, 2.7, 0xd6a23a, 'metal'); // yellow fibre tray
  const leds = []; for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) leds.push([rx + 1.4 + r * 1.2, ry + 1.22, 0.85 + i * 0.2]);
  // lobby canopy, sign, rooftop
  k.box(10, 3, 0.3, 6, -d / 2 - 1.5, 3.2, 0xe4e6e7).box(9, 0.3, 1.2, 6, -d / 2 - 0.2, H - 2.2, 0xf0a35b, 'light');
  chillers(k, 4, 3, H + 0.8, 4); k.box(5, 4, 3, -7, 2, H + 0.8, 0xd4d7d9);
  k.cyl(0.1, 9, -9, -4, H + 0.8, 0xc7ccd0, 'metal', 6).dish(0.7, -7.8, -4, H + 4.5, 230, 45);
  const cols = [0xb8c0c6, 0x2b3a52, 0xd9d6cf, 0x8b1e1e, 0x55606b, 0xeaeaea];
  for (let i = 0; i < 9; i++) car(k, -w / 2 - 2 + i * 3.2, -d / 2 - 12, Math.PI / 2, cols[i % cols.length]);
  for (let i = 0; i < 5; i++) tree(k, -w / 2 - 12, -d / 2 + i * 8, 6 + (i % 2));
  lamp(k, -w / 2 - 4, -d / 2 - 8); lamp(k, w / 2 + 4, -d / 2 - 8); lamp(k, w / 2 + 12, d / 2);
  void name; return { kit: k, leds };
}

// Microwave relay tower on the KKH: a square steel lattice, dishes aimed along the chain, an equipment shelter.
export function latticeTower({ prevAz = 0, nextAz = 180, H = 42 } = {}) {
  const k = new Kit(), b = 3.2;
  for (const [ax, ay] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.bar([ax * b, ay * b, 0], [ax * 0.7, ay * 0.7, H], 0.22, 0xd9dde0);
  for (let z = 0, j = 0; z < H - 3; z += 3.5, j++) {
    const r0 = b - (b - 0.7) * z / H, r1 = b - (b - 0.7) * (z + 3.5) / H;
    for (const [ax, ay, bx, by] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
      k.bar([ax * r0, ay * r0, z], [bx * r1, by * r1, z + 3.5], 0.09, j % 2 ? 0xd9dde0 : 0xe2472f); // aviation red/white bands
      k.bar([bx * r0, by * r0, z], [ax * r1, ay * r1, z + 3.5], 0.09, j % 2 ? 0xd9dde0 : 0xe2472f);
    }
  }
  k.dish(1.2, Math.sin(prevAz * Math.PI / 180) * 1.4, Math.cos(prevAz * Math.PI / 180) * 1.4, H - 6, prevAz, 0).dish(1.2, Math.sin(nextAz * Math.PI / 180) * 1.4, Math.cos(nextAz * Math.PI / 180) * 1.4, H - 9, nextAz, 0);
  k.box(0.3, 0.3, 0.3, 0, 0, H, 0xff3b30, 'light');
  k.box(4, 3, 2.8, 6, 2, 0, 0xc9c3b3).box(4.3, 3.3, 0.2, 6, 2, 2.8, 0x8d939a, 'metal'); // shelter
  return k;
}

// Khunjerab Pass (4,693 m): the border gate arch, customs building, barrier and the fibre hut.
export function khunjerab() {
  const k = new Kit();
  k.box(60, 18, 0.2, 0, 0, 0, 0x4a4d50); // road
  for (const x of [-9, 9]) k.box(3, 4, 11, x, 0, 0, 0xd6c7a6);
  k.box(21, 4, 3, 0, 0, 11, 0xd6c7a6).box(21.4, 4.4, 1.2, 0, 0, 14, 0xb3262b); // arch with a red roof band
  k.box(9, 0.3, 0.3, -2, -6, 1, 0xd9452f, 'metal').box(9, 0.3, 0.3, 2, 6, 1, 0xd9452f, 'metal'); // barriers
  k.box(22, 12, 6, -12, 22, 0, 0xe2dccb).box(22.6, 12.6, 1.5, -12, 22, 6, 0x6d7a5b, 'metal'); // customs post, pitched-look roof band
  for (let i = 0; i < 5; i++) k.box(2, 0.2, 1.4, -20 + i * 4, 15.9, 2.4, 0x34414d, 'glass');
  k.box(3, 2.4, 2.6, 16, 14, 0, 0xc9c3b3).box(3.3, 2.7, 0.2, 16, 14, 2.6, 0x8d939a, 'metal'); // fibre hut
  return k;
}

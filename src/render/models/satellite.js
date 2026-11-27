// PakSat-MM1, a representative model built in code (docs/ROUND2.md §3): it is built on CAST's DFH-4E
// platform (launched 30 May 2024, REFERENCES §1.5, S39), so the proportions follow the DFH-4 family
// (box bus, two long solar wings, two big reflectors), not the NASA SSL-1300 reference.
// Local frame in metres: x east, y north (the solar wings' axis), z up (away from the Earth); the Earth
// deck with the antennas faces down (−z). Returns the body and the two wings (turned to face the sun).
import { Kit } from './kit.js';

const GOLD = 0xc9a04a, GOLD2 = 0xb38a36, SILVER = 0xd5d9dc, CELL = 0x1b2a4a, WHITE = 0xeeeeea;

export function paksat() {
  const k = new Kit(), W = 2.4, Dp = 2.1, H = 3.6; // bus: 2.4 × 2.1 × 3.6 m
  // the bus in gold multi-layer insulation: slightly varied panels read as crinkled foil
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const c = (i + j) % 2 ? GOLD : GOLD2;
    k.box(W / 4 + 0.01, 0.02, H / 3 + 0.01, -W / 2 + W / 8 + i * W / 4, -Dp / 2, -H / 2 + j * H / 3, c, 'metal');
    k.box(W / 4 + 0.01, 0.02, H / 3 + 0.01, -W / 2 + W / 8 + i * W / 4, Dp / 2, -H / 2 + j * H / 3, c, 'metal');
  }
  k.box(0.02, Dp, H, -W / 2, 0, -H / 2, GOLD, 'metal').box(0.02, Dp, H, W / 2, 0, -H / 2, GOLD2, 'metal');
  k.box(W - 0.1, Dp - 0.1, H - 0.05, 0, 0, -H / 2 + 0.02, 0x8a7034, 'metal'); // inner core
  k.box(1.9, 0.03, 2.6, 0, -Dp / 2 - 0.02, -1.3, SILVER, 'metal').box(1.9, 0.03, 2.6, 0, Dp / 2 + 0.02, -1.3, SILVER, 'metal'); // radiators (north / south)
  // Earth deck (−z): Ka-band spot-beam antennas, a C-band horn cluster, telemetry antenna
  const deck = -H / 2;
  k.box(W, Dp, 0.05, 0, 0, deck - 0.05, WHITE);
  for (const [x, y] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]]) k.dish(0.32, x, y, deck - 0.05, 0, -90, WHITE);
  for (let i = 0; i < 3; i++) k.cyl(0.08, 0.35, -0.15 + i * 0.15, 0, deck - 0.4, SILVER, 'metal', 8, 0.14);
  k.cyl(0.05, 0.9, 0, 0.8, deck - 0.9, SILVER, 'metal', 6);
  // two big reflectors on the east and west faces, each with its feed horn
  for (const s of [-1, 1]) {
    const x = s * (W / 2 + 1.25), z = deck + 0.4;
    k.dish(1.25, x, 0, z, s > 0 ? 270 : 90, -55, WHITE); // tilted towards the Earth
    k.bar([s * W / 2, 0, z + 0.6], [x - s * 0.3, 0, z + 0.2], 0.06, SILVER);
    k.cyl(0.12, 0.45, s * (W / 2 + 0.2), 0, deck - 0.2, SILVER, 'metal', 8, 0.2); // feed horn
  }
  // aft (+z): apogee engine nozzle, four thrusters, two star trackers, top antenna
  k.cyl(0.35, 0.7, 0, 0, H / 2, 0x55585b, 'metal', 16, 0.18);
  for (const [x, y] of [[-1, -0.9], [1, -0.9], [-1, 0.9], [1, 0.9]]) k.cyl(0.06, 0.18, x, y, H / 2, 0x6a6d70, 'metal', 8, 0.03);
  k.box(0.22, 0.22, 0.35, 0.8, 0.6, H / 2, 0x2b2f33, 'metal').box(0.22, 0.22, 0.35, -0.8, 0.6, H / 2, 0x2b2f33, 'metal');
  k.dish(0.5, 0, -0.6, H / 2 + 0.05, 0, 90, WHITE);
  const body = k.build();

  // solar wings along ±y: a yoke and three 2.3 × 2.0 m panels each, cells with silver grid lines
  const wings = [-1, 1].map(s => {
    const w = new Kit();
    w.bar([0, s * Dp / 2, 0], [0, s * (Dp / 2 + 1.4), 0], 0.06, SILVER);
    for (let p = 0; p < 3; p++) {
      const yc = s * (Dp / 2 + 1.4 + 1.0 + p * 2.05);
      w.box(2.3, 2.0, 0.04, 0, yc, -0.02, CELL, 'glass');
      for (let g = 1; g < 6; g++) w.box(0.012, 2.0, 0.045, -1.15 + g * 0.383, yc, -0.022, SILVER, 'metal');
      for (let g = 1; g < 4; g++) w.box(2.3, 0.012, 0.045, 0, yc - 1 + g * 0.5, -0.022, SILVER, 'metal');
      w.box(2.32, 2.02, 0.03, 0, yc, -0.06, 0xdde1e4, 'matte'); // white back side
    }
    const g = w.build(); return g;
  });
  return { body, wings };
}

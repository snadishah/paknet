// Markers for scenario events, built in code like the other models (kit.js), metres, z up.
// buoy(): a red-and-white marker buoy, as repair ships leave over a cut submarine cable.
// barrier(): a striped road barrier with warning lamps, for a cut on land (a landslide on the KKH).
import { Kit } from './kit.js';

const RED = 0xd8393c, WHITE = 0xf2f2ee, DARK = 0x2a2f35, AMBER = 0xffb43a;

export function buoy() {
  const k = new Kit();
  k.cyl(1.3, 1.1, 0, 0, -0.4, RED, 'matte', 20).cyl(1.32, 0.35, 0, 0, 0.7, WHITE, 'matte', 20); // float with a white band
  k.cyl(0.5, 2.4, 0, 0, 1.05, RED, 'matte', 12, 0.25); // tapered day-mark
  for (let i = 0; i < 3; i++) k.box(0.9 - i * 0.18, 0.06, 0.25, 0, 0, 1.5 + i * 0.55, WHITE); // reflective stripes
  k.cyl(0.05, 1.0, 0, 0, 3.45, DARK, 'metal', 6).box(0.35, 0.35, 0.35, 0, 0, 4.4, AMBER, 'light'); // mast and flashing lamp
  return k.build();
}

export function barrier() {
  const k = new Kit(), L = 7;
  for (const x of [-L / 2, L / 2]) k.box(0.15, 0.6, 1.1, x, 0, 0, DARK, 'metal').box(0.25, 0.25, 0.3, x, 0, 1.1, AMBER, 'light');
  for (let i = 0; i < 7; i++) k.box(L / 7, 0.12, 0.35, -L / 2 + L / 14 + i * L / 7, 0, 0.7, i % 2 ? WHITE : RED);
  for (let i = 0; i < 5; i++) k.cyl(0.25, 0.75, -2.6 + i * 1.3, -1.4, 0, 0xff6a1a, 'matte', 10, 0.04); // traffic cones
  return k.build();
}

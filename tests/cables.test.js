import { describe, it, expect } from 'vitest';
import DATA from '../src/data/cables.json';
import { CABLE_LIST } from '../src/graph/topology.js';
import { gcDistance } from '../src/geo/globe.js';

// src/data/cables.json is baked by scripts/fetch-cables.mjs (TeleGeography routes)
describe('real cable routes', () => {
  it('every cable direction the simulator uses has a route from Karachi to a named landing', () => {
    for (const c of CABLE_LIST) for (const d of c.dirs) {
      const r = DATA.cables[c.id]?.routes[d], dest = DATA.cables[c.id]?.dest[d];
      expect(r, `${c.id} ${d}`).toBeTruthy(); expect(dest?.name).toBeTruthy();
      expect(gcDistance(r[1], r[0], 24.85, 66.95), `${c.id} ${d} starts in Karachi`).toBeLessThan(40);
      expect(gcDistance(r.at(-1), r.at(-2), dest.lat, dest.lon), `${c.id} ${d} ends at ${dest.name}`).toBeLessThan(1);
    }
  });
  it('westbound cables also stop in the Gulf, and the credit names TeleGeography', () => {
    for (const c of CABLE_LIST) if (c.dirs.includes('W')) expect(DATA.cables[c.id].dest.G.name).toMatch(/United Arab Emirates|Oman/);
    expect(DATA.credit).toMatch(/TeleGeography/); expect(DATA.credit).toMatch(/CC BY-NC-SA/);
  });
});

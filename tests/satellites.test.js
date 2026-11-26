import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeSnapshot, GROUPS } from '../src/sat/catalog.js';
import { makeRecords, geodeticAt, positionsAt, ecefAt, orbitRing } from '../src/sat/propagate.js';

const SNAP = JSON.parse(readFileSync(new URL('../src/data/satellites.json', import.meta.url), 'utf8'));
const groups = decodeSnapshot(SNAP);
const at = new Date(SNAP.fetched);
const rec = norad => makeRecords(groups.paksat.sats.filter(s => s.NORAD_CAT_ID === norad))[0];

describe('satellite snapshot (CelesTrak)', () => {
  it('has a fetch date and the PakSat group with MM1 and 1R', () => {
    expect(Number.isNaN(at.getTime())).toBe(false);
    const ids = groups.paksat.sats.map(s => s.NORAD_CAT_ID);
    expect(ids).toContain(59915); expect(ids).toContain(37779);
  });
  it('PakSat-MM1 sits above 38.2°E on the equator at GEO height (±0.5°)', () => {
    const g = geodeticAt(rec(59915), at);
    expect(Math.abs(g.lon - 38.2)).toBeLessThan(0.5);
    expect(Math.abs(g.lat)).toBeLessThan(0.5);
    expect(Math.abs(g.alt - 35786)).toBeLessThan(100);
  });
  it('PakSat-MM1 stays put over a week (geostationary)', () => {
    const g = geodeticAt(rec(59915), new Date(at.getTime() + 7 * 86400e3));
    expect(Math.abs(g.lon - 38.2)).toBeLessThan(0.5);
  });
  it('every sampled satellite propagates to a finite position near the fetch date', () => {
    for (const [k, gr] of Object.entries(groups)) {
      if (!gr.sats.length) continue; // e.g. Telesat Lightspeed: nothing in orbit yet
      const recs = makeRecords(gr.sats); const out = positionsAt(recs, at, new Float32Array(recs.length * 3));
      let ok = 0; for (let i = 0; i < recs.length; i++) if (Number.isFinite(out[i * 3])) ok++;
      expect(ok / Math.max(1, recs.length), k).toBeGreaterThan(0.95);
    }
  });
  it('low-orbit constellations are low and sampled to ≤ 300', () => {
    for (const k of ['starlink', 'oneweb', 'kuiper', 'qianfan']) {
      const gr = groups[k]; if (!gr) continue;
      expect(gr.sats.length).toBeLessThanOrEqual(300);
      const g = geodeticAt(makeRecords([gr.sats[0]])[0], at); expect(g.alt).toBeLessThan(1500);
    }
    expect(GROUPS.starlink.role).toBe('soon');
  });
  it('bad elements give null instead of throwing', () => {
    expect(ecefAt(null, at)).toBeNull();
    expect(makeRecords([{ OBJECT_NAME: 'BROKEN' }])[0]).toBeNull();
  });
  it('an orbit ring closes on itself', () => {
    const r = makeRecords([groups.starlink.sats[0]])[0]; const ring = orbitRing(r, at, 64);
    expect(ring.length).toBeGreaterThan(60);
    const d = Math.hypot(ring[0][0] - ring.at(-1)[0], ring[0][1] - ring.at(-1)[1], ring[0][2] - ring.at(-1)[2]);
    expect(d).toBeLessThan(200);
  });
});

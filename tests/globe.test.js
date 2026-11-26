import { describe, it, expect } from 'vitest';
import { R, latLonToEcef, ecefToLatLon, ecefToEnu, enuToLatLon, enuToEcef, flatToLatLon, latLonToFlat, gcDistance, greatCircle, subSolarPoint } from '../src/geo/globe.js';
import { P, unP } from '../src/geo/projection.js';

describe('globe projection', () => {
  it('latLonToEcef puts the axes where expected', () => {
    const a = latLonToEcef(0, 0); expect(a[0]).toBeCloseTo(R); expect(a[1]).toBeCloseTo(0); expect(a[2]).toBeCloseTo(0);
    const b = latLonToEcef(0, 90); expect(b[1]).toBeCloseTo(R);
    const c = latLonToEcef(90, 0, 100); expect(c[2]).toBeCloseTo(R + 100);
  });
  it('ecefToLatLon inverts latLonToEcef (Karachi, 300 m up)', () => {
    const p = latLonToEcef(24.86, 67.01, 0.3); const ll = ecefToLatLon(...p);
    expect(ll.lat).toBeCloseTo(24.86, 9); expect(ll.lon).toBeCloseTo(67.01, 9); expect(ll.alt).toBeCloseTo(0.3, 6);
  });
  it('ecefToEnu: the origin is 0,0,0 and a point 1 km north reads ~1000 m north', () => {
    const o = ecefToEnu(latLonToEcef(31.55, 74.34), 31.55, 74.34); o.forEach(v => expect(Math.abs(v)).toBeLessThan(1e-6));
    const north = ecefToEnu(latLonToEcef(31.55 + 1 / 111.195, 74.34), 31.55, 74.34);
    expect(north[1]).toBeCloseTo(1000, -1); expect(Math.abs(north[0])).toBeLessThan(1);
    const up = ecefToEnu(latLonToEcef(31.55, 74.34, 0.5), 31.55, 74.34); expect(up[2]).toBeCloseTo(500, 3);
  });
  it('enuToLatLon inverts ecefToEnu', () => {
    const enu = [420, -350, 12]; const ll = enuToLatLon(enu, 33.69, 73.05);
    const back = ecefToEnu(latLonToEcef(ll.lat, ll.lon, ll.alt), 33.69, 73.05);
    back.forEach((v, i) => expect(v).toBeCloseTo(enu[i], 6));
    const p = enuToEcef([0, 0, 0], 33.69, 73.05), q = latLonToEcef(33.69, 73.05); p.forEach((v, i) => expect(v).toBeCloseTo(q[i], 9));
  });
  it('flat plane ↔ lat/lon agrees with projection.js', () => {
    const v = P(67.01, 24.86); const ll = flatToLatLon(v.x, v.y);
    expect(ll.lon).toBeCloseTo(67.01, 9); expect(ll.lat).toBeCloseTo(24.86, 9);
    const f = latLonToFlat(24.86, 67.01); expect(unP({ x: f.x, y: f.y })[0]).toBeCloseTo(67.01, 9);
  });
  it('great circles: Karachi–Lahore distance and arc end points', () => {
    expect(gcDistance(24.86, 67.01, 31.55, 74.34)).toBeGreaterThan(1000); expect(gcDistance(24.86, 67.01, 31.55, 74.34)).toBeLessThan(1060);
    const arc = greatCircle(24.86, 67.01, 43.3, 5.37, 20);
    expect(arc).toHaveLength(21); expect(arc[0][0]).toBeCloseTo(24.86, 6); expect(arc[20][1]).toBeCloseTo(5.37, 6);
  });
  it('sub-solar point: near the equinox the Sun is overhead near the equator at noon UTC on 0°', () => {
    const s = subSolarPoint(new Date('2026-03-20T12:00:00Z'));
    expect(Math.abs(s.lat)).toBeLessThan(1); expect(Math.abs(s.lon)).toBeLessThan(3);
    const j = subSolarPoint(new Date('2026-06-21T12:00:00Z')); expect(j.lat).toBeCloseTo(23.44, 0);
  });
});

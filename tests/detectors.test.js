// Anomaly detectors on synthetic data.
import { describe, it, expect } from 'vitest';
import { entropy, createRateDetector, createEntropyDetector, createBeaconDetector } from '../src/defence/detectors.js';

// deterministic pseudo-random numbers for repeatable tests
const rng = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(42);
const expo = mean => -Math.log(1 - rng()) * mean;

describe('entropy', () => {
  it('is 0 for one source and log2(n) for n equal sources', () => {
    expect(entropy(new Map([['a', 5]]))).toBe(0);
    expect(entropy(new Map([['a', 1], ['b', 1], ['c', 1], ['d', 1]]))).toBeCloseTo(2, 9);
  });
});

describe('rate detector', () => {
  it('stays quiet through a slow daily swing and noise', () => {
    const d = createRateDetector();
    let alarms = 0;
    for (let i = 0; i < 400; i++) { const x = 500 + 300 * Math.sin(i / 60) + (rng() - 0.5) * 80; if (d.observe('dc', x).alarm) alarms++; }
    expect(alarms).toBe(0);
  });
  it('flags a flood within one window', () => {
    const d = createRateDetector();
    for (let i = 0; i < 50; i++) d.observe('dc', 400 + (rng() - 0.5) * 50);
    expect(d.observe('dc', 8000).alarm).toBe(true);
  });
  it('does not learn the attack as normal', () => {
    const d = createRateDetector();
    for (let i = 0; i < 50; i++) d.observe('dc', 400);
    for (let i = 0; i < 30; i++) expect(d.observe('dc', 8000).alarm).toBe(true);
  });
});

describe('entropy detector', () => {
  it('flags traffic suddenly arriving from many sources', () => {
    const d = createEntropyDetector();
    for (let i = 0; i < 20; i++) d.observe('dc', new Map([['Lahore', 10], ['Kasur', 2]]));
    const many = new Map(Array.from({ length: 64 }, (_, k) => ['city' + k, 5]));
    const r = d.observe('dc', many);
    expect(r.alarm).toBe(true);
    expect(r.delta).toBeGreaterThan(4);
  });
});

describe('beacon detector', () => {
  it('flags strictly periodic connections', () => {
    const d = createBeaconDetector(); let r, t = 0;
    for (let i = 0; i < 20; i++) { t += 0.2 * (1 + (rng() - 0.5) * 0.05); r = d.observe('Mardan>c2', t); }
    expect(r.alarm).toBe(true);
    expect(r.period).toBeCloseTo(0.2, 1);
  });
  it('ignores ordinary random traffic', () => {
    const d = createBeaconDetector(); let alarms = 0, t = 0;
    for (let i = 0; i < 300; i++) { t += expo(0.2); if (d.observe('Mardan>svc3', t).alarm) alarms++; }
    expect(alarms).toBe(0);
  });
});

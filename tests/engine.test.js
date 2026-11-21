// The discrete-event engine on tiny hand-built graphs.
import { describe, it, expect } from 'vitest';
import { createEngine } from '../src/sim/engine.js';

// A chain of nodes 0-1-2-… with the given capacities (Gbps) and delays (ms).
function chain(caps, delays) {
  const edges = caps.map((c, i) => ({ id: i, a: i, b: i + 1, cap: c, delay: delays[i], cut: false }));
  const eng = createEngine({ capacityGbps: e => e.cap, delayMs: e => e.delay, usable: e => !e.cut, bufferMs: 5 });
  const seq = edges.map((_, i) => i).concat(edges.length);
  return { eng, edges, send: (opt = {}) => eng.inject(seq, edges, opt) };
}

describe('engine: an idle path', () => {
  it('delay = sum of transmission + propagation per hop', () => {
    const { eng, send } = chain([100, 50], [3, 4]);
    const delivered = []; eng.hooks.deliver = b => delivered.push(b);
    send({ gbit: 1 }); // tx: 1/100 s = 10 ms, then 1/50 s = 20 ms
    eng.run(1000);
    expect(delivered).toHaveLength(1);
    expect(delivered[0].delay).toBeCloseTo(10 + 3 + 20 + 4, 6);
  });
  it('a near-zero-size probe sees only propagation', () => {
    const { eng, send } = chain([1000, 1000, 1000], [2, 2, 2]);
    let d; eng.hooks.deliver = b => (d = b.delay);
    send({ gbit: 1e-9 }); eng.run(100);
    expect(d).toBeCloseTo(6, 4);
  });
});

describe('engine: queues', () => {
  it('serves bundles first in, first out', () => {
    const { eng, send } = chain([10], [1]);
    const order = []; eng.hooks.deliver = b => order.push(b.opt.tag);
    for (let i = 0; i < 5; i++) send({ gbit: 0.01, tag: i });
    eng.run(1000);
    expect(order).toEqual([0, 1, 2, 3, 4]);
  });
  it('queueing delay grows for bundles further back', () => {
    const { eng, send } = chain([10], [1]);
    const delays = []; eng.hooks.deliver = b => delays.push(b.delay);
    for (let i = 0; i < 3; i++) send({ gbit: 0.01 }); // 1 ms each to transmit
    eng.run(1000);
    expect(delays.map(d => +d.toFixed(6))).toEqual([2, 3, 4]);
  });
  it('tail-drops about half the traffic offered at twice the capacity', () => {
    // 10 Gbps link, 0.01 Gbit bundles → 1 ms each; offer one every 0.5 ms for 2 s.
    const { eng, send } = chain([10], [1]);
    for (let t = 0; t < 2000; t += 0.5) { eng.run(t); send({ gbit: 0.01 }); }
    eng.run(5000);
    const { offered, delivered, droppedBy } = eng.counters;
    expect(offered).toBe(4000);
    expect(droppedBy.queue / offered).toBeGreaterThan(0.45);
    expect(droppedBy.queue / offered).toBeLessThan(0.55);
    expect(delivered + droppedBy.queue).toBe(offered);
  });
  it('the buffer holds bufferMs of line rate', () => {
    const { eng } = chain([100], [1]);
    const L = eng.link({ id: 0, a: 0, b: 1, cap: 100, delay: 1 }, 0);
    expect(L.bufGbit).toBeCloseTo(0.5, 9); // 100 Gbps × 5 ms
  });
});

describe('engine: failures', () => {
  it('drops bundles on a link when it is cut, and refuses new ones', () => {
    const { eng, edges, send } = chain([1], [50]);
    for (let i = 0; i < 3; i++) send({ gbit: 0.001 }); // 1 ms each
    eng.run(1.5); // first on the wire, second transmitting, third queued
    edges[0].cut = true; eng.cut(edges[0]);
    eng.run(500);
    expect(eng.counters.delivered).toBe(0);
    expect(eng.counters.droppedBy.down).toBe(3);
    send({ gbit: 0.001 }); eng.run(1000);
    expect(eng.counters.droppedBy.down).toBe(4);
  });
  it('counts blackholed and blocked bundles as lost', () => {
    const { eng, send } = chain([100], [1]);
    send({ blackhole: true }); send({ blocked: true }); eng.run(100);
    expect(eng.counters.delivered).toBe(0);
    expect(eng.counters.droppedBy.blackhole).toBe(1);
    expect(eng.counters.droppedBy.blocked).toBe(1);
  });
});

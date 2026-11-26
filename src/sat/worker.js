// Web Worker: propagates every satellite with SGP4 so the main thread never does.
// The main thread asks at most 5 times a second for positions at two times
// (now and a little ahead) and interpolates between them every frame.
//   in : { type: 'init', omms }            → { type: 'ready', n }
//        { type: 'pos', t0, t1, id }       → { type: 'pos', id, a, b }   (Float32Array ECEF km, NaN = no fix)
//        { type: 'rings', idx: [...], t }  → { type: 'rings', rings: [[x, y, z]…]… }
import { makeRecords, positionsAt, orbitRing } from './propagate.js';

let recs = [];
self.onmessage = ({ data: m }) => {
  if (m.type === 'init') { recs = makeRecords(m.omms); self.postMessage({ type: 'ready', n: recs.length }); }
  else if (m.type === 'pos') {
    const a = positionsAt(recs, new Date(m.t0), new Float32Array(recs.length * 3));
    const b = positionsAt(recs, new Date(m.t1), new Float32Array(recs.length * 3));
    self.postMessage({ type: 'pos', id: m.id, t0: m.t0, t1: m.t1, a, b }, [a.buffer, b.buffer]);
  } else if (m.type === 'rings') {
    self.postMessage({ type: 'rings', rings: m.idx.map(i => orbitRing(recs[i], new Date(m.t))) });
  }
};

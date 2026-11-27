import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { streetProps } from '../src/render/streets.js';
import { buoy, barrier } from '../src/render/models/markers.js';
import { paksat } from '../src/render/models/satellite.js';

const positions = m => { const o = new THREE.Matrix4(), p = new THREE.Vector3(), out = []; for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, o); out.push(p.setFromMatrixPosition(o).clone()); } return out; };

describe('street life', () => {
  // one main road and one street, 400 m each, with a 60 × 60 m building beside the street
  const streets = { s: [[0, -200, 0, 200, 0], [1, 0, -200, 0, 200]] };
  const building = [20, 20, 80, 80], inB = (x, y, m) => x > building[0] - m && x < building[2] + m && y > building[1] - m && y < building[3] + m;
  const g = streetProps(streets, (x, y, m) => !inB(x, y, m));

  it('lines the streets with trees, lamps and cars as three instanced meshes', () => {
    expect(g.children.length).toBe(3);
    for (const m of g.children) { expect(m.isInstancedMesh).toBe(true); expect(m.count).toBeGreaterThan(0); }
  });
  it('never puts anything inside a building', () => {
    for (const m of g.children) for (const p of positions(m)) expect(inB(p.x, p.y, 0)).toBe(false);
  });
  it('places the same things on every visit (seeded)', () => {
    const again = streetProps(streets, (x, y, m) => !inB(x, y, m));
    expect(again.children.map(m => m.count)).toEqual(g.children.map(m => m.count));
    expect(positions(again.children[0])[5].distanceTo(positions(g.children[0])[5])).toBe(0);
  });
});

describe('models built in code', () => {
  it('cut markers stay within the 5-draw-call model budget', () => {
    for (const m of [buoy(), barrier()]) { expect(m.children.length).toBeGreaterThan(0); expect(m.children.length).toBeLessThanOrEqual(5); }
  });
  it('PakSat-1R is weathered and has its wings folded', () => {
    const live = paksat(), old = paksat({ retired: true });
    const span = w => new THREE.Box3().setFromObject(w).getSize(new THREE.Vector3()).y;
    expect(span(old.wings[0])).toBeLessThan(1); // folded flat against the bus
    expect(span(live.wings[0])).toBeGreaterThan(5); // open: three 2 m panels
    const colourOf = g => { const c = g.children.find(m => m.userData.surface === 'metal').geometry.attributes.color; return [c.getX(0), c.getY(0), c.getZ(0)]; };
    const [r, gg, b] = colourOf(old.body), [r0, g0, b0] = colourOf(live.body);
    expect(Math.max(r, gg, b) - Math.min(r, gg, b)).toBeLessThan(Math.max(r0, g0, b0) - Math.min(r0, g0, b0)); // greyer
  });
});

import { describe, it, expect } from 'vitest';
import { fadeIn, fadeOut, showLayer, updateFades } from '../src/render/fade3d.js';

// a stand-in for a three.js object with one material
const obj = (opacity = 0.8) => { const m = { opacity, transparent: false, userData: {} }; const o = { visible: true, userData: {}, material: m, traverse(f) { f(o); } }; return o; };

describe('scene fades', () => {
  it('fades in to the material’s own opacity and out to zero, then calls done', () => {
    const o = obj(0.8); fadeIn(o, 300);
    expect(o.material.opacity).toBe(0); updateFades(0.15); expect(o.material.opacity).toBeGreaterThan(0); updateFades(0.2); expect(o.material.opacity).toBeCloseTo(0.8);
    let done = false; fadeOut(o, 300, () => { done = true; }); updateFades(0.31); expect(o.material.opacity).toBe(0); expect(done).toBe(true);
  });
  it('hides a layer only once it has faded out, and brings it back to full', () => {
    const g = obj(0.5); showLayer(g, false, 400); updateFades(0.2); expect(g.visible).toBe(true); updateFades(0.25); expect(g.visible).toBe(false);
    showLayer(g, true, 400); expect(g.visible).toBe(true); updateFades(0.5); expect(g.material.opacity).toBeCloseTo(0.5);
  });
});

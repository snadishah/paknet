// Draws the network on the globe: backbone, submarine cables (with illustrative
// onward great-circle routes), microwave, satellite links, planned links, province
// borders, and every node as a small screen-space marker (one Points object per layer).
// Also creates the remaining layer groups in their original order.
import * as THREE from 'three';
import COUNTRIES from '../data/borders.json'; // simplified by scripts/simplify-borders.mjs
import { PROV } from '../geo/coast.js';
import { latLonToFlat, greatCircle, GEO_ALT } from '../geo/globe.js';
import { layer, fatLine, fatSegs, camera, renderer, disposeLine, onResize } from './scene.js';
import { toGlobe, fromLatLon, edgeGlobe, mapPolyline } from './geo3.js';

// PakSat-MM1's position (ECEF km). Phase 2's satellite module updates it from the orbit data.
export const paksatPos = fromLatLon(0, 38.2, GEO_ALT);

// Illustrative onward routes beyond the map edge (real end points, guessed paths).
export const ONWARD = {
  W: { label: 'Marseille, France', pts: [[22.6, 59.9], [16.0, 53.5], [12.4, 45.5], [12.6, 43.4], [19.5, 39.0], [27.5, 34.0], [29.9, 32.55], [31.6, 32.3], [34.2, 25.0], [37.3, 12.0], [43.3, 5.37]] },
  E: { label: 'Singapore', pts: [[19.0, 71.9], [12.0, 73.8], [6.5, 77.5], [5.6, 80.6], [6.0, 95.0], [3.8, 99.8], [1.27, 103.85]] },
  SW: { label: 'Djibouti', pts: [[17.0, 58.0], [12.8, 51.0], [11.6, 43.2]] },
  SW2: { label: 'Mombasa, Kenya', pts: [[17.0, 58.0], [8.0, 53.0], [0.0, 46.0], [-4.05, 39.7]] }
};

const TIER_STYLE = { // [shape (0 dot, 1 ring, 2 square, 3 diamond), size px, colour]
  core: [1, 11, '#f4f1ea'], agg: [0, 5.5, '#dfe6ea'], intl: [1, 9, '#9cc7e0'], cls: [2, 8, '#f0a35b'], ixp: [3, 9, '#e8c35a'],
  dc: [2, 7, '#b9a3f0'], gw: [0, 7, '#b9a3f0'], vsat: [0, 5, '#b9a3f0'], tower: [3, 5, '#b9a3f0'], access: [0, 3, '#c9d2d6'], office: [2, 11, '#f0c27a']
};

export const glyphUniforms = { uScale: { value: 1 }, uPR: { value: renderer.getPixelRatio() } };
const glyphMat = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: { ...glyphUniforms, uOpacity: { value: 1 } },
  vertexShader: `attribute float aSize; attribute float aShape; attribute vec3 aColor; uniform float uScale; uniform float uPR;
    varying float vShape; varying vec3 vC;
    void main(){ vShape=aShape; vC=aColor; gl_PointSize = aSize * uScale * uPR; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `varying float vShape; varying vec3 vC; uniform float uOpacity;
    void main(){ vec2 p = gl_PointCoord*2.-1.; float r = length(p); float a;
      if (vShape < .5) a = 1.-smoothstep(.7,1.,r);
      else if (vShape < 1.5) { a = (1.-smoothstep(.75,1.,r)); if (r < .45) { gl_FragColor = vec4(vec3(.08,.1,.12), a*uOpacity*.85); return; } }
      else if (vShape < 2.5) { float m = max(abs(p.x),abs(p.y)); a = 1.-smoothstep(.7,.95,m); }
      else { float m = abs(p.x)+abs(p.y); a = 1.-smoothstep(.75,1.,m); }
      if (a <= 0.) discard;
      // a soft dark outline keeps markers readable over bright land
      float edge = smoothstep(.55,.95, vShape < 1.5 ? r : (vShape < 2.5 ? max(abs(p.x),abs(p.y)) : abs(p.x)+abs(p.y)));
      gl_FragColor = vec4(mix(vC, vC*.35, edge*.6), a*uOpacity); }`
});

function nodePoints(list, extra = {}) {
  const n = list.length, pos = new Float32Array(n * 3), size = new Float32Array(n), shape = new Float32Array(n), col = new Float32Array(n * 3), c = new THREE.Color();
  list.forEach((nd, i) => {
    const st = TIER_STYLE[nd.tier] || TIER_STYLE.agg; pos.set([nd.gpos.x, nd.gpos.y, nd.gpos.z], i * 3);
    shape[i] = st[0]; size[i] = nd.tier === 'access' ? st[1] * (0.8 + Math.min(1.2, Math.pow((nd.pop || 1) / 80000, 0.3))) : st[1];
    c.set(nd.planned ? '#e98b3a' : st[2]); col.set([c.r, c.g, c.b], i * 3);
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); g.setAttribute('aShape', new THREE.BufferAttribute(shape, 1)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const p = new THREE.Points(g, glyphMat()); p.frustumCulled = false; p.renderOrder = 6; p.userData.nodes = list; Object.assign(p.userData, extra); return p;
}

export function drawNetwork(G) {
  const { nodes, edges, cableEdges, plannedEdges, SAT, accessNodes } = G;
  // globe position of every node (render-only)
  for (const n of nodes) n.gpos = n.tier === 'sat' ? paksatPos : toGlobe(n.pos.x, n.pos.y, 0);
  const gBorders = layer('borders'), gCables = layer('cables'), gBackbone = layer('backbone'), gMW = layer('microwave', false), gSat = layer('satellite', false),
    gPlanned = layer('planned', false), gCities = layer('cities', false), gLastMile = layer('lastmile', false), gRouters = layer('routers'), gGate = layer('gateways'), gOff = layer('offices');
  layer('packets'); layer('heat', false); layer('fx'); layer('labels');

  // borders: Pakistan's provinces (thin) and the neighbours' outlines (fainter)
  {
    const ring = r => mapPolyline(r.map(([lo, la]) => { const f = latLonToFlat(la, lo); return { x: f.x, y: f.y }; }), 0.25);
    const segs = (rings, out) => { for (const r of rings) { const p = ring(r); for (let i = 1; i < p.length; i++) out.push({ a: p[i - 1], b: p[i] }); } return out; };
    const prov = segs(Object.values(PROV).flatMap(polys => polys.map(p => p[0])), []);
    gBorders.add(fatSegs(prov, { color: 0xffffff, linewidth: 1, opacity: 0.32 }));
    const nb = segs(['IND', 'AFG', 'IRN', 'CHN', 'OMN', 'TJK', 'ARE'].flatMap(k => (COUNTRIES[k] || []).map(p => p[0])), []);
    gBorders.add(fatSegs(nb, { color: 0xffffff, linewidth: 0.8, opacity: 0.16 }));
  }

  // backbone: fibre trunks brighter than regional fibre; dashed aerial / cross-border / microwave
  {
    const segsOf = list => { const s = []; for (const e of list) { const p = edgeGlobe(e); for (let i = 1; i < p.length; i++) s.push({ a: p[i - 1], b: p[i] }); } return s; };
    const fib = edges.filter(e => e.type === 'fiber');
    gBackbone.add(fatSegs(segsOf(fib.filter(e => e.ops.length >= 3)), { color: 0xf3efe6, linewidth: 1.7, opacity: 0.8 }));
    gBackbone.add(fatSegs(segsOf(fib.filter(e => e.ops.length < 3)), { color: 0xe6ebee, linewidth: 1.0, opacity: 0.5 }));
    gBackbone.add(fatSegs(segsOf(edges.filter(e => e.type === 'aerial' || e.type === 'xborder')), { color: 0xe6ebee, linewidth: 1.0, opacity: 0.55, dashed: true, dashSize: 6, gapSize: 5 }));
    gBackbone.add(fatSegs(segsOf(edges.filter(e => e.type === 'microwave')), { color: 0xe6ebee, linewidth: 0.9, opacity: 0.45, dashed: true, dashSize: 3, gapSize: 4 }));
    gMW.add(fatSegs(segsOf(edges.filter(e => e.type === 'mwbackup')), { color: 0xb9a3f0, linewidth: 1.2, opacity: 0.8, dashed: true, dashSize: 3, gapSize: 3 }));
    gLastMile.add(fatSegs(segsOf(edges.filter(e => (e.type === 'access' || e.type === 'mwaccess') && !e.office)), { color: 0xc9d2d6, linewidth: 0.6, opacity: 0.25 }));
    // each illustrative office's line to its city router
    gOff.add(fatSegs(segsOf(edges.filter(e => e.office)), { color: 0xf0c27a, linewidth: 1.6, opacity: 0.85 }));
  }
  gBackbone.children.forEach(c => c.userData.o = c.material.opacity);

  // submarine cables
  for (const e of cableEdges) {
    const c = e.cable; const live = c.status === 'live';
    e.line = fatLine(edgeGlobe(e), { color: c.status === 'retired' ? 0x8a949a : 0x8fc3e6, linewidth: live ? 1.4 : 1.0, opacity: live ? 0.8 : 0.45, dashed: !live, dashSize: 8, gapSize: 6 });
    gCables.add(e.line);
  }
  // onward routes (illustrative), joined to the map-edge end points
  for (const k of Object.keys(ONWARD)) {
    const o = ONWARD[k]; const pts = [];
    for (let i = 1; i < o.pts.length; i++) { const arc = greatCircle(...o.pts[i - 1], ...o.pts[i], 16); arc.forEach(([la, lo], j) => { if (i === 1 || j > 0) pts.push(fromLatLon(la, lo)); }); }
    o.gpts = pts; o.end = pts[pts.length - 1];
    gCables.add(fatLine(pts, { color: 0x8fc3e6, linewidth: 1.0, opacity: 0.38, dashed: true, dashSize: 10, gapSize: 8 }));
  }
  for (const e of plannedEdges) gPlanned.add(fatLine(edgeGlobe(e), { color: 0xe98b3a, linewidth: 1.6, opacity: 0.9, dashed: true, dashSize: 6, gapSize: 5 }));

  // satellite links: straight from each ground station up to PakSat-MM1
  const satEdges = edges.filter(e => e.type === 'sat');
  let satLines = null;
  function refreshSatLinks() {
    if (satLines) { gSat.remove(satLines); disposeLine(satLines); }
    satLines = fatSegs(satEdges.map(e => ({ a: nodes[e.a].tier === 'sat' ? nodes[e.b].gpos : nodes[e.a].gpos, b: paksatPos })), { color: 0xb9a3f0, linewidth: 0.9, opacity: 0.45, dashed: true, dashSize: 400, gapSize: 300 });
    gSat.add(satLines);
  }
  refreshSatLinks();

  // node markers, one Points object per layer
  const by = f => nodes.filter(f);
  const groups = [
    [gRouters, by(n => n.tier === 'core' || n.tier === 'agg' || (n.tier === 'intl' && !n.hideLabel))],
    [gGate, by(n => (n.tier === 'cls' && !n.planned) || n.tier === 'ixp' || n.tier === 'dc')],
    [gPlanned, by(n => n.tier === 'cls' && n.planned)],
    [gSat, by(n => n.tier === 'gw' || n.tier === 'vsat')],
    [gMW, by(n => n.tier === 'tower')],
    [gCities, accessNodes],
    [gOff, by(n => n.tier === 'office')]
  ];
  const markers = groups.map(([g, list]) => { const p = nodePoints(list); g.add(p); return p; });
  onResize(() => { glyphUniforms.uPR.value = renderer.getPixelRatio(); });

  // Screen-space picking: the nearest visible marker within `radius` px of (x, y).
  const v = new THREE.Vector3(), camDir = new THREE.Vector3();
  function pick(x, y, radius = 14) {
    let best = null, bd = radius * radius;
    for (const m of markers) {
      if (!isVisible(m)) continue;
      for (const n of m.userData.nodes) {
        // skip markers on the far side of the Earth
        camDir.copy(camera.position).sub(n.gpos); if (camDir.dot(n.gpos) < 0) continue;
        v.copy(n.gpos).project(camera); if (v.z > 1) continue;
        const sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight, d = (sx - x) ** 2 + (sy - y) ** 2;
        if (d < bd) { bd = d; best = n; }
      }
    }
    return best;
  }
  const isVisible = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };

  return { markers, pick, refreshSatLinks, setAccScale() {}, pickables: [], accMesh: null };
}

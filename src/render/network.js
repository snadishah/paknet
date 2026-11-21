// Draws the network layers: backbone, cables, microwave, satellite, planned,
// last mile, router glyphs and city dots. Also creates the remaining layer
// groups in their original order (packets, heat, fx, labels).
import * as THREE from 'three';
import { TOP, lift } from '../geo/projection.js';
import { INK } from '../palette.js';
import { layer, fatLine, fatSegs } from './scene.js';

export function drawNetwork(G) {
  const { nodes, edges, cableEdges, plannedEdges, SAT, accessNodes } = G;
  const gCables = layer('cables'), gBackbone = layer('backbone'), gMW = layer('microwave', false), gSat = layer('satellite', false),
    gPlanned = layer('planned', false), gCities = layer('cities'), gLastMile = layer('lastmile', false), gRouters = layer('routers'),
    gGate = layer('gateways');
  layer('packets'); layer('heat', false); layer('fx'); layer('labels');

  {
    const fib = edges.filter(e => e.type === 'fiber');
    const trunk = fib.filter(e => e.ops.length >= 3), minor = fib.filter(e => e.ops.length < 3);
    const seg = (list, dz = 0) => list.map(e => ({ a: lift(e.pts[0], dz), b: lift(e.pts[e.pts.length - 1], dz) }));
    gBackbone.add(fatSegs(seg(trunk), { color: 0xffffff, linewidth: 5.5, opacity: 0.55 }));
    gBackbone.add(fatSegs(seg(minor), { color: 0xffffff, linewidth: 3.5, opacity: 0.45 }));
    gBackbone.add(fatSegs(seg(trunk, 0.002), { color: INK, linewidth: 2.4, opacity: 0.85 }));
    gBackbone.add(fatSegs(seg(minor, 0.002), { color: INK, linewidth: 1.3, opacity: 0.7 }));
    const dashedTypes = edges.filter(e => e.type === 'aerial' || e.type === 'xborder');
    gBackbone.add(fatSegs(dashedTypes.map(e => ({ a: lift(e.pts[0]), b: lift(e.pts[e.pts.length - 1]) })), { color: INK, linewidth: 1.4, opacity: 0.7, dashed: true, dashSize: 0.06, gapSize: 0.05 }));
    const mw = edges.filter(e => e.type === 'microwave');
    gBackbone.add(fatSegs(mw.map(e => ({ a: e.pts[0], b: e.pts[1] })), { color: INK, linewidth: 1.1, opacity: 0.55, dashed: true, dashSize: 0.025, gapSize: 0.035 }));
    const mwb = edges.filter(e => e.type === 'mwbackup');
    gMW.add(fatSegs(mwb.map(e => ({ a: e.pts[0], b: e.pts[1] })), { color: 0x7c3aed, linewidth: 1.4, opacity: 0.85, dashed: true, dashSize: 0.03, gapSize: 0.03 }));
    const acc = []; for (const e of edges.filter(e => e.type === 'access' || e.type === 'mwaccess')) acc.push(e.pts[0].x, e.pts[0].y, TOP + 0.006, e.pts[1].x, e.pts[1].y, TOP + 0.006);
    const ga = new THREE.BufferGeometry(); ga.setAttribute('position', new THREE.Float32BufferAttribute(acc, 3));
    gLastMile.add(new THREE.LineSegments(ga, new THREE.LineBasicMaterial({ color: 0x22312b, transparent: true, opacity: 0.25 })));
  }
  gBackbone.children.forEach(c => c.userData.o = c.material.opacity);

  for (const e of cableEdges) {
    const c = e.cable; const live = c.status === 'live';
    e.line = fatLine(e.pts, { color: c.status === 'retired' ? 0x9aa6a0 : 0x2f4858, linewidth: live ? 1.6 : 1.1, opacity: live ? 0.75 : 0.5, dashed: !live, dashSize: 0.1, gapSize: 0.08 });
    gCables.add(e.line);
  }
  for (const e of plannedEdges) gPlanned.add(fatLine(e.pts, { color: 0xc2410c, linewidth: 1.8, opacity: 0.85, dashed: true, dashSize: 0.08, gapSize: 0.06 }));
  for (const e of edges.filter(e => e.type === 'sat')) gSat.add(fatLine(e.pts, { color: 0x7c3aed, linewidth: 1, opacity: 0.45, dashed: true, dashSize: 0.08, gapSize: 0.08 }));
  { // satellite model
    const s = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.26), new THREE.MeshLambertMaterial({ color: 0xf4f4f0 }));
    const pm = new THREE.MeshLambertMaterial({ color: 0x3a5a8c, side: THREE.DoubleSide });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.24, 0.01), pm); p1.position.x = 0.55; const p2 = p1.clone(); p2.position.x = -0.55;
    s.add(body, p1, p2); s.position.copy(SAT.pos); s.traverse(o => o.castShadow = true); gSat.add(s); SAT.mesh = s;
  }

  // router glyphs
  const pickables = [];
  const M = (c) => new THREE.MeshLambertMaterial({ color: c });
  const mInk = M(INK), mWhite = M(0xffffff);
  for (const n of nodes) {
    let m = null;
    if (n.tier === 'core') {
      m = new THREE.Group();
      const o = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 32), mInk); o.rotation.x = Math.PI / 2; o.position.z = 0.025;
      const i = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.056, 32), mWhite); i.rotation.x = Math.PI / 2; i.position.z = 0.028;
      m.add(o, i);
      const q = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.12, 64), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, uniforms: { uFill: { value: 0.2 }, uCol: { value: new THREE.Color('#16a34a') } },
        vertexShader: `varying vec2 vU; void main(){ vU=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `uniform float uFill; uniform vec3 uCol; varying vec2 vU; void main(){ float a=atan(vU.x,vU.y)/6.2831853+.5; gl_FragColor = a>uFill ? vec4(1.,1.,1.,.55) : vec4(uCol,1.); }`
      }));
      q.position.z = 0.004; q.visible = false; m.add(q); n.queue = q;
    } else if (n.tier === 'agg') {
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 20), mInk); m.rotation.x = Math.PI / 2; m.position.z = 0.015;
      const g = new THREE.Group(); g.add(m); m = g;
    } else if (n.tier === 'cls') {
      m = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), M(n.planned ? 0xd97706 : 0xc2410c)); b.position.z = 0.03; b.castShadow = true; m.add(b);
    } else if (n.tier === 'ixp') {
      m = new THREE.Group(); const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), M(0xca8a04)); d.position.z = 0.05; d.castShadow = true; m.add(d); m.userData.spin = d;
    } else if (n.tier === 'dc') {
      m = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.07), M(0x6d28d9)); b.position.z = 0.035; b.castShadow = true; m.add(b);
    } else if (n.tier === 'gw' || n.tier === 'vsat') {
      m = new THREE.Group(); const d = new THREE.Mesh(new THREE.SphereGeometry(n.tier === 'gw' ? 0.04 : 0.028, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0x7c3aed)); d.rotation.x = -0.9; d.position.z = 0.02; m.add(d);
      m.position.copy(n.pos); gSat.add(m); n.mesh = m; m.traverse(o => o.userData.node = n); pickables.push(m); continue;
    } else if (n.tier === 'tower') {
      m = new THREE.Group(); const t = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.09, 4), M(0x7c3aed)); t.rotation.x = Math.PI / 2; t.position.z = 0.045; m.add(t);
      m.position.copy(n.pos); gMW.add(m); n.mesh = m; m.traverse(o => o.userData.node = n); pickables.push(m); continue;
    } else if (n.tier === 'intl') {
      m = new THREE.Group(); const r = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.1, 40), new THREE.MeshBasicMaterial({ color: 0x2f4858 })); m.add(r);
    }
    if (!m) continue;
    m.position.copy(n.pos); n.mesh = m; m.traverse(o => o.userData.node = n);
    (n.tier === 'core' || n.tier === 'agg' || n.tier === 'intl' ? gRouters : n.planned ? gPlanned : gGate).add(m); pickables.push(m);
  }

  // all cities as small dots
  const accMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.016, 12), new THREE.MeshBasicMaterial({ color: 0x22312b, transparent: true, opacity: 0.5 }), accessNodes.length);
  function setAccScale(f) { const m4 = new THREE.Matrix4(); accessNodes.forEach((n, i) => { const s = f * (0.8 + Math.min(1.2, Math.pow(n.pop / 80000, 0.35))); m4.makeScale(s, s, 1).setPosition(n.pos.x, n.pos.y, TOP + 0.005); accMesh.setMatrixAt(i, m4); }); accMesh.instanceMatrix.needsUpdate = true; }
  setAccScale(1); gCities.add(accMesh); pickables.push(accMesh);

  return { pickables, accMesh, setAccScale };
}

// Packets: one THREE.Points with a custom shader; each packet draws a short trail.
// Positions come from the simulator's flat hop geometry and are mapped onto the
// globe every frame (no allocations). Satellite hops go straight up to PakSat-MM1.
import * as THREE from 'three';
import { samplePath } from '../routing/paths.js';
import { MAXP } from '../sim/traffic.js';
import { renderer, layers } from './scene.js';
import { toGlobe } from './geo3.js';

const TRAIL = 4;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(MAXP * TRAIL * 3), pCol = new Float32Array(MAXP * TRAIL * 3), pSize = new Float32Array(MAXP * TRAIL), pAlpha = new Float32Array(MAXP * TRAIL);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3));
pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1)); pGeo.setAttribute('aAlpha', new THREE.BufferAttribute(pAlpha, 1));
for (const a of ['position', 'aColor', 'aSize', 'aAlpha']) pGeo.attributes[a].setUsage(THREE.DynamicDrawUsage);
export const packetUniforms = { uPR: { value: renderer.getPixelRatio() }, uScale: { value: 1 } };
const pMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.NormalBlending, uniforms: packetUniforms,
  vertexShader: `attribute float aSize; attribute vec3 aColor; attribute float aAlpha; uniform float uPR; uniform float uScale; varying vec3 vC; varying float vA;
  void main(){ vC=aColor; vA=aAlpha; gl_PointSize = clamp(aSize * 70. * uScale, 2.5, 10.) * uPR; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  // soft glow: bright core fading to the packet colour, no hard edge
  fragmentShader: `varying vec3 vC; varying float vA; void main(){ float r=length(gl_PointCoord-.5)*2.; if(r>1.) discard;
    float core = 1.-smoothstep(0.,.45,r); float halo = 1.-smoothstep(.2,1.,r);
    gl_FragColor = vec4(mix(vC, vec3(1.), core*.55), halo*vA); }`
});

const colorCache = new Map();
const colorOf = (css) => { let c = colorCache.get(css); if (!c) { c = new THREE.Color().setStyle(css, THREE.LinearSRGBColorSpace); colorCache.set(css, c); } return c; };

let nodes = null;
export function initPackets(G) {
  nodes = G.nodes;
  const pPoints = new THREE.Points(pGeo, pMat); pPoints.frustumCulled = false; pPoints.renderOrder = 10; layers.packets.add(pPoints);
}

const tmp = [0, 0, 0], v = new THREE.Vector3();
// Globe position of distance d along a hop path, into out.
function hopPos(path, d, out) {
  const e = path.edges[0];
  if (e && e.type === 'sat') {
    const a = nodes[path.seq[0]].gpos, b = nodes[path.seq[1]].gpos, f = Math.max(0, Math.min(1, d / path.total));
    return out.copy(a).lerp(b, f);
  }
  samplePath(path, d, tmp); return toGlobe(tmp[0], tmp[1], 0, out);
}

export function drawPackets(packets) {
  let j = 0;
  for (const pk of packets) {
    const col = colorOf(pk.color);
    for (let k = 0; k < TRAIL; k++) {
      hopPos(pk.path, pk.d - k * 0.035, v); const o = j * 3; pPos[o] = v.x; pPos[o + 1] = v.y; pPos[o + 2] = v.z;
      pCol[o] = col.r; pCol[o + 1] = col.g; pCol[o + 2] = col.b; pSize[j] = pk.size * (1 - k * 0.2); pAlpha[j] = k === 0 ? 1 : 0.5 - k * 0.12; j++;
    }
  }
  pGeo.setDrawRange(0, j);
  for (const a of ['position', 'aColor', 'aSize', 'aAlpha']) { const at = pGeo.attributes[a]; at.clearUpdateRanges(); at.addUpdateRange(0, j * at.itemSize); at.needsUpdate = true; }
}

// Globe position of a packet at distance d along its hop.
export function packetPos(pk, d) { return hopPos(pk.path, d, new THREE.Vector3()); }

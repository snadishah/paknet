// Packets: one THREE.Points with a custom shader; each packet draws a short trail.
import * as THREE from 'three';
import { samplePath } from '../routing/paths.js';
import { MAXP } from '../sim/traffic.js';
import { renderer, layers } from './scene.js';

const TRAIL = 4;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(MAXP * TRAIL * 3), pCol = new Float32Array(MAXP * TRAIL * 3), pSize = new Float32Array(MAXP * TRAIL), pAlpha = new Float32Array(MAXP * TRAIL);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3));
pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1)); pGeo.setAttribute('aAlpha', new THREE.BufferAttribute(pAlpha, 1));
const pMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: { uPR: { value: renderer.getPixelRatio() } },
  vertexShader: `attribute float aSize; attribute vec3 aColor; attribute float aAlpha; uniform float uPR; varying vec3 vC; varying float vA;
  void main(){ vC=aColor; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=clamp(aSize*uPR*(1800./-mv.z),3.,13.); gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vC; varying float vA; void main(){ float r=length(gl_PointCoord-.5)*2.; if(r>1.) discard; float edge=smoothstep(1.,.78,r); vec3 c=mix(vec3(1.),vC,smoothstep(.0,.55,r)*.9+.1); gl_FragColor=vec4(c,edge*vA); }`
});

const colorCache = new Map();
const colorOf = (css) => { let c = colorCache.get(css); if (!c) { c = new THREE.Color().setStyle(css, THREE.LinearSRGBColorSpace); colorCache.set(css, c); } return c; };

export function initPackets() {
  const pPoints = new THREE.Points(pGeo, pMat); pPoints.frustumCulled = false; pPoints.renderOrder = 10; layers.packets.add(pPoints);
}

const tmp = [0, 0, 0];
export function drawPackets(packets) {
  let j = 0;
  for (const pk of packets) {
    const col = colorOf(pk.color);
    for (let k = 0; k < TRAIL; k++) {
      samplePath(pk.path, pk.d - k * 0.04, tmp); const o = j * 3; pPos[o] = tmp[0]; pPos[o + 1] = tmp[1]; pPos[o + 2] = tmp[2];
      pCol[o] = col.r; pCol[o + 1] = col.g; pCol[o + 2] = col.b; pSize[j] = pk.size * (1 - k * 0.2); pAlpha[j] = k === 0 ? 1 : 0.5 - k * 0.12; j++;
    }
  }
  pGeo.setDrawRange(0, j); for (const a of ['position', 'aColor', 'aSize', 'aAlpha']) pGeo.attributes[a].needsUpdate = true;
}

// World position of a packet at distance d along its path.
export function packetPos(pk, d) { samplePath(pk.path, d, tmp); return new THREE.Vector3(tmp[0], tmp[1], tmp[2]); }

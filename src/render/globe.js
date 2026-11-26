// The Earth seen from space: a sphere with a custom shader (NASA Blue Marble by
// day, Black Marble city lights by night, blended across the real terminator,
// a soft ocean glint and a thin atmosphere rim), an outer atmosphere halo and
// a subtle starfield. Lighting: 'natural' (real sun) or 'flood' (all lit).
import * as THREE from 'three';
import { R, latLonToEcef } from '../geo/globe.js';
import { scene, camera, isPhone, renderer } from './scene.js';
import { altitudeKm } from './globecam.js';

const tex = (url, onload) => {
  const t = new THREE.TextureLoader().load(url, onload, undefined, () => onload?.(null));
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
};

// Sphere with ECEF vertex positions and equirectangular UVs (seam duplicated).
function sphereGeometry(nLon, nLat) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nLat; j++) {
    const lat = 90 - 180 * j / nLat;
    for (let i = 0; i <= nLon; i++) { const lon = -180 + 360 * i / nLon; pos.push(...latLonToEcef(lat, lon, 0)); uv.push(i / nLon, 1 - j / nLat); }
  }
  for (let j = 0; j < nLat; j++) for (let i = 0; i < nLon; i++) {
    const a = j * (nLon + 1) + i, b = a + nLon + 1;
    if (j > 0) idx.push(a, b, a + 1); if (j < nLat - 1) idx.push(a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeBoundingSphere(); return g;
}

export const globeUniforms = {
  uDay: { value: null }, uNight: { value: null }, uSun: { value: new THREE.Vector3(1, 0, 0) }, uFlood: { value: 0 },
  uNightGain: { value: 1.0 }, uReady: { value: 0 }
};

const earthMat = new THREE.ShaderMaterial({
  uniforms: globeUniforms,
  vertexShader: /* glsl */`
    varying vec3 vN; varying vec3 vW; varying vec2 vUv;
    void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */`
    uniform sampler2D uDay; uniform sampler2D uNight; uniform vec3 uSun; uniform float uFlood; uniform float uNightGain; uniform float uReady;
    varying vec3 vN; varying vec3 vW; varying vec2 vUv;
    void main(){
      vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vW);
      vec3 day = texture2D(uDay, vUv).rgb; vec3 night = texture2D(uNight, vUv).rgb;
      day = mix(vec3(0.03, 0.06, 0.12), day, uReady);
      float ndl = dot(n, uSun);
      float dayMix = mix(smoothstep(-0.12, 0.18, ndl), 1.0, uFlood);
      // daylight: gentle Lambert with a floor so the twilight band isn't black
      vec3 lit = day * mix(0.12 + 1.05 * max(ndl, 0.0), 1.0, uFlood);
      // ocean glint: water is where blue clearly beats red and green
      float ocean = smoothstep(0.02, 0.12, day.b - max(day.r, day.g));
      vec3 h = normalize(uSun + v); float spec = pow(max(dot(n, h), 0.0), 60.0) * 0.35 * ocean * step(0.0, ndl) * (1.0 - uFlood);
      // city lights: Black Marble, warmed and boosted, only on the night side
      vec3 lights = pow(night, vec3(1.6)) * vec3(1.6, 1.25, 0.8) * 2.2 * uNightGain;
      vec3 nightCol = night * 0.10 + lights;
      vec3 col = mix(nightCol, lit + spec, dayMix);
      // thin atmosphere rim on the lit side
      float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
      col += vec3(0.30, 0.55, 1.0) * fres * 0.55 * mix(smoothstep(-0.25, 0.4, ndl), 1.0, uFlood);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`
});

const atmoMat = new THREE.ShaderMaterial({
  uniforms: { uSun: globeUniforms.uSun, uFlood: globeUniforms.uFlood, uAlpha: { value: 1 } },
  side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform vec3 uSun; uniform float uFlood; uniform float uAlpha; varying vec3 vN; varying vec3 vW;
    void main(){ vec3 v = normalize(cameraPosition - vW); float rim = pow(clamp(1.0 + dot(normalize(vN), v) * 1.0, 0.0, 1.0), 5.0);
      float lit = mix(smoothstep(-0.35, 0.35, dot(normalize(vN), uSun)), 1.0, uFlood);
      gl_FragColor = vec4(vec3(0.32, 0.58, 1.0) * rim * 0.9 * lit * uAlpha, 1.0); }`
});

export const earth = new THREE.Mesh(sphereGeometry(isPhone ? 128 : 192, isPhone ? 64 : 96), earthMat);
earth.name = 'earth'; earth.renderOrder = -2;
const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.025, 96, 48), atmoMat); atmo.renderOrder = -1;

// Stars: a fixed sky that follows the camera (so they never reach the far plane).
const stars = (() => {
  const n = isPhone ? 1500 : 2600, p = new Float32Array(n * 3), s = new Float32Array(n);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const z = rnd() * 2 - 1, t = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    p.set([r * Math.cos(t) * 30000, r * Math.sin(t) * 30000, z * 30000], i * 3); s[i] = 0.25 + Math.pow(rnd(), 6) * 0.9;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aB', new THREE.BufferAttribute(s, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: { uPR: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float aB; varying float vB; uniform float uPR; void main(){ vB=aB; gl_PointSize=(1.0+aB*1.6)*uPR; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying float vB; void main(){ float r=length(gl_PointCoord-.5)*2.; if(r>1.) discard; gl_FragColor=vec4(vec3(0.85,0.9,1.0), (1.-r)*vB*0.8); }`
  });
  const o = new THREE.Points(g, m); o.renderOrder = -10; o.frustumCulled = false; return o;
})();

export function buildGlobe() {
  scene.add(stars, earth, atmo);
  const big = !isPhone && renderer.capabilities.maxTextureSize >= 4096;
  // the 2k textures show the first screen quickly; on desktops the 4k ones replace them once loaded
  return new Promise(res => {
    let left = 2; const done = () => { if (--left === 0) { globeUniforms.uReady.value = 1; res(); if (big) upgrade(); } };
    globeUniforms.uDay.value = tex('assets/textures/earth-day-2k.jpg', done);
    globeUniforms.uNight.value = tex('assets/textures/earth-night-2k.jpg', done);
  });
  function upgrade() {
    for (const [u, name] of [['uDay', 'day'], ['uNight', 'night']]) {
      const t = tex(`assets/textures/earth-${name}-4k.jpg`, ok => { if (!ok) return; const old = globeUniforms[u].value; globeUniforms[u].value = t; old.dispose(); });
    }
  }
}

// Sun direction in ECEF from the sub-solar point.
export function setSun(lat, lon) { const p = latLonToEcef(lat, lon, 0); globeUniforms.uSun.value.set(p[0], p[1], p[2]).normalize(); }
export const setFlood = on => { globeUniforms.uFlood.value = on ? 1 : 0; };
export function updateGlobe() {
  stars.position.copy(camera.position);
  // the outer halo is for the view from space; it fades out before the camera reaches its shell (~160 km)
  const a = THREE.MathUtils.smoothstep(altitudeKm, 500, 2500); atmoMat.uniforms.uAlpha.value = a; atmo.visible = a > 0.001;
}

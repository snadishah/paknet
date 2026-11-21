// Basemap: ground plane, flat neighbouring countries, extruded province slabs.
import * as THREE from 'three';
import COUNTRIES from '../../data/countries.json';
import { PROV } from '../geo/coast.js';
import { P, H, BEV, TOP } from '../geo/projection.js';
import { PROV_COL } from '../palette.js';
import { layer, fatLine } from './scene.js';

const toShape = (ring) => ring.map(([lo, la]) => { const v = P(lo, la); return new THREE.Vector2(v.x, v.y); });
function polysToShapes(polys) { return polys.map(poly => { const s = new THREE.Shape(toShape(poly[0])); poly.slice(1).forEach(h => s.holes.push(new THREE.Path(toShape(h)))); return s; }); }

export function buildBasemap() {
  const gBase = layer('base');
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshLambertMaterial({ color: 0xe1e9e8 }));
  ground.receiveShadow = true; gBase.add(ground);
  const nbMat = new THREE.MeshLambertMaterial({ color: 0xd6ddd6 });
  for (const k of ['IND', 'AFG', 'IRN', 'CHN', 'OMN', 'TJK', 'ARE']) {
    if (!COUNTRIES[k]) continue;
    const m = new THREE.Mesh(new THREE.ShapeGeometry(polysToShapes(COUNTRIES[k])), nbMat); m.position.z = 0.004; m.receiveShadow = true; gBase.add(m);
    COUNTRIES[k].forEach(poly => gBase.add(fatLine(poly[0].map(([lo, la]) => P(lo, la, 0.008)), { color: 0xc3ccc5, linewidth: 1, opacity: 1 })));
  }
  const provMeshes = {};
  for (const [name, polys] of Object.entries(PROV)) {
    const geo = new THREE.ExtrudeGeometry(polysToShapes(polys), { depth: H, bevelEnabled: true, bevelThickness: BEV, bevelSize: 0.014, bevelSegments: 2, curveSegments: 1 });
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: PROV_COL[name] }));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.prov = name; gBase.add(mesh); provMeshes[name] = mesh;
    polys.forEach(poly => gBase.add(fatLine(poly[0].map(([lo, la]) => P(lo, la, TOP + 0.002)), { color: 0xffffff, linewidth: 1.2, opacity: 0.55 })));
  }
  return { provMeshes };
}

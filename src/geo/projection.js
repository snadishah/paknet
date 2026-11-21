// Map projection and vertical layout constants.
// Equirectangular projection centred on Pakistan, x scaled by cos(lat0).
// One world unit ≈ one degree of latitude ≈ 111 km.
import { Vector3 } from 'three';

export const LON0 = 69.3, LAT0 = 30.2, KX = Math.cos(LAT0 * Math.PI / 180);
export const H = 0.30;          // province slab height
export const BEV = 0.018;       // slab bevel
export const TOP = H + BEV;     // top surface of the slabs
export const NET = TOP + 0.02;  // height at which the network is drawn
export const KM_PER_UNIT = 111;

export const P = (lon, lat, z = 0) => new Vector3((lon - LON0) * KX, lat - LAT0, z);
export const unP = (v) => [v.x / KX + LON0, v.y + LAT0];
export const lift = (p, dz = 0) => p.clone().setZ(p.z + dz);

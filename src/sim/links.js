// Physical properties of a link: capacity and propagation delay. Used by the
// packet engine (queues, transmission) and by OSPF (link costs, flooding delay).
// Values and sources: src/sim/params.js and docs/REFERENCES.md §7.
import { KM_PER_UNIT } from '../geo/projection.js';
import {
  propDelayMs, GEO_HOP_MS, CABLE_GBPS, GWADAR_CABLE_GBPS, EDGE_GBPS, FIBRE_GBPS_PER_OPERATOR, ACCESS_GBPS_PER_PERSON
} from './params.js';

// Capacity of an edge per direction, in Gbps.
export function edgeCapacityGbps(G, e) {
  if (e.cable) return (CABLE_GBPS[e.cable.id] ?? 1000) / e.cable.dirs.length;
  if (e.type === 'planned') return e.plannedCable ? GWADAR_CABLE_GBPS : EDGE_GBPS.planned;
  if (e.type === 'fiber') return Math.max(1, e.ops.length) * (e.ops.length >= 3 ? FIBRE_GBPS_PER_OPERATOR.trunk : FIBRE_GBPS_PER_OPERATOR.regional);
  if (e.type === 'metro') {
    const t = [G.nodes[e.a], G.nodes[e.b]];
    if (t.some(n => n.scrub)) return EDGE_GBPS.scrub;
    if (t.some(n => n.tier === 'dc')) return EDGE_GBPS.dc;
    if (t.some(n => n.tier === 'ixp')) return EDGE_GBPS.ixp;
    return EDGE_GBPS.metro;
  }
  if (e.type === 'access') return Math.max(EDGE_GBPS.access, (G.nodes[e.a].pop || 0) * ACCESS_GBPS_PER_PERSON);
  if (e.type === 'sat') return G.nodes[e.a].tier === 'gw' || G.nodes[e.b].tier === 'gw' ? EDGE_GBPS.satGateway : EDGE_GBPS.satTerminal;
  return EDGE_GBPS[e.type] ?? EDGE_GBPS.fiber;
}

// One-way propagation delay of an edge, in ms.
export const edgeDelayMs = e => (e.type === 'sat' ? GEO_HOP_MS : propDelayMs(e.len * KM_PER_UNIT));

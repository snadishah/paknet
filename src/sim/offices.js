// Five ILLUSTRATIVE offices (Karachi, Lahore, Islamabad, Peshawar, Quetta) and the
// read-only APIs the visual traceroute needs. Pure: no three.js, no DOM.
//
// Each office is a host node attached to the nearest city router (like a town:
// node.parent + one 'access' edge), so the routing algorithms are unchanged; it
// only adds a leaf. Its traffic is real simulator traffic: bundles injected into
// the packet engine by the time-of-day profile, following the active protocol.
import { P, NET } from '../geo/projection.js';
import { state } from '../state.js';
import { diurnal } from './traffic.js';
import { edgeDelayMs } from './links.js';

// Locations are illustrative business districts (REFERENCES §8.3).
export const OFFICES = [
  { key: 'karachi', city: 'Karachi', name: 'Karachi office', lat: 24.8495, lon: 67.0105 },
  { key: 'lahore', city: 'Lahore', name: 'Lahore office', lat: 31.5120, lon: 74.3440 },
  { key: 'islamabad', city: 'Islamabad', name: 'Islamabad office', lat: 33.7105, lon: 73.0590 },
  { key: 'peshawar', city: 'Peshawar', name: 'Peshawar office', lat: 34.0000, lon: 71.5400 },
  { key: 'quetta', city: 'Quetta', name: 'Quetta office', lat: 30.1910, lon: 67.0090 }
];

// What the office sends (share of its traffic) and where it goes. Destinations are illustrative.
export const DESTS = {
  youtube: { label: 'YouTube video', share: 0.5, kind: 'intl', dir: 'W', far: 'Google server — illustrative location (Europe)' },
  whatsapp: { label: 'WhatsApp message to Dubai', share: 0.2, kind: 'intl', dir: 'W', far: 'WhatsApp server — illustrative, message delivered in Dubai' },
  email: { label: 'Email to a friend in Lahore', share: 0.3, kind: 'dom' }
};
// Each dot leaving an office is one of its flows: a small real bundle (OFFICE_GBIT)
// that queues and travels like any other, at OFFICE_DOTS_PER_S per office at the
// evening peak, shaped by the same time-of-day curve as the rest of the network.
// Volume is illustrative: small enough not to change the network's load.
export const OFFICE_DOTS_PER_S = 6, OFFICE_GBIT = 0.002;

const ROUTER_TIERS = new Set(['core', 'agg']);

// Add the five offices to the topology. Call before createNetwork().
export function addOffices(G) {
  const out = [];
  for (const o of OFFICES) {
    const pos = P(o.lon, o.lat, NET);
    let best = null, bd = Infinity;
    for (const n of G.nodes) if (ROUTER_TIERS.has(n.tier) && n.kind === 'city') { const d = n.pos.distanceToSquared(pos); if (d < bd) { bd = d; best = n; } }
    const id = G.nodes.length;
    const node = { id, name: o.name, key: o.key, lon: o.lon, lat: o.lat, pos, tier: 'office', kind: 'office', parent: best, illustrative: true };
    G.nodes.push(node); G.adj.set(id, []); G.byName[o.name] = node;
    const e = { id: G.edges.length, a: id, b: best.id, type: 'access', ops: [], pts: [pos, best.pos], cut: false, load: 0, office: true };
    e.len = pos.distanceTo(best.pos);
    G.edges.push(e); G.adj.get(id).push(e); G.adj.get(best.id).push(e);
    out.push(node);
  }
  G.OFFICES = out;
  return out;
}

const other = (e, u) => (e.a === u ? e.b : e.a);
const join = (a, b) => (!a || !b ? null : a.fate && a.fate !== 'ok' ? a : { seq: [...a.seq, ...b.seq.slice(1)], edges: [...a.edges, ...b.edges], fate: b.fate || 'ok' });

export function createOffices(G, net, traffic) {
  const { N, INTL, IXP } = G;
  const byKey = Object.fromEntries(G.OFFICES.map(o => [o.key, o]));

  // ---------- read-only routing views ----------
  // The path a bundle from src to dst takes right now, under the active protocol.
  const getPath = (src, dst) => net.forward(src, dst);

  // The international cable the office's operator would use for direction `dir`:
  // the biggest live cable that way, else any live cable, else null (China fibre).
  function cableFor(dir) {
    const live = []; for (const c of net.liveCables()) for (const e of c.edges) if (!e.cut && net.usable(e)) live.push(e);
    const pick = list => list.sort((a, b) => (b.cable.share - a.cable.share) || a.id - b.id)[0] || null;
    return pick(live.filter(e => e.dir === dir)) || pick(live);
  }
  // The domestic friend: Lahore, or Karachi when the office is in Lahore.
  const friendOf = office => (office.key === 'lahore' ? byKey.karachi : byKey.lahore);
  // The exchange on the way: the IXP in the office's city, else the nearest one.
  function ixpFor(office) {
    let best = null, bd = Infinity;
    for (const x of IXP) { const d = x.pos.distanceToSquared(office.pos); if (d < bd) { bd = d; best = x; } }
    return best;
  }

  // Full path from an office to a destination key, as { seq, edges, fate, far }.
  function pathTo(office, destKey) {
    const d = DESTS[destKey];
    if (d.kind === 'dom') { // via the internet exchange, so the email stays inside Pakistan
      const ix = ixpFor(office), friend = friendOf(office);
      const p = join(getPath(office.id, ix.id), getPath(ix.id, friend.id));
      return p && { ...p, friend, ixp: ix };
    }
    const ce = cableFor(d.dir);
    if (!ce) { const p = getPath(office.id, INTL.N.id); return p && { ...p, far: d.far, viaChina: true }; }
    const ls = G.nodes[ce.a].tier === 'intl' ? ce.b : ce.a, far = other(ce, ls);
    const p = join(getPath(office.id, ls), { seq: [ls, far], edges: [ce], fate: 'ok' });
    return p && { ...p, far: d.far, cable: ce.cable };
  }

  // ---------- office traffic: real bundles in the engine ----------
  let carry = 0;
  const KEYS = Object.keys(DESTS);
  function spawn(sdt) {
    if (sdt <= 0) return;
    carry += G.OFFICES.length * OFFICE_DOTS_PER_S * diurnal(state.simHour) * sdt;
    while (carry >= 1) {
      carry -= 1;
      const o = G.OFFICES[Math.floor(Math.random() * G.OFFICES.length)];
      let r = Math.random(), key = KEYS[KEYS.length - 1]; for (const k of KEYS) { if (r < DESTS[k].share) { key = k; break; } r -= DESTS[k].share; }
      const p = pathTo(o, key); if (!p || !p.edges.length) continue;
      traffic.emitPacket(p, DESTS[key].kind === 'dom' ? 'dom' : 'intl', { office: o.key, dest: key, size: 0.13, gbit: OFFICE_GBIT });
    }
  }

  // Bundles from this office that are in the network now (live sim flows).
  function getFlowsFrom(key) { const out = []; for (const b of traffic.engine.bundles) if (b.opt.office === key) out.push(b); return out; }

  // Delivered office bundles: measured one-way delay per destination (ms), recent average.
  const measured = {};
  const prevDeliver = traffic.engine.hooks.deliver;
  traffic.engine.hooks.deliver = b => {
    if (b.opt.office) { const k = b.opt.office + '|' + b.opt.dest; const m = measured[k] ||= { n: 0, avg: 0 }; m.n++; m.avg += ((b.delay ?? 0) - m.avg) / Math.min(m.n, 20); }
    prevDeliver(b);
  };

  // Visual traceroute: hop by hop, with the delay measured on each link right now
  // (propagation + the queue in front of the bundle + transmission).
  function traceroute(key, destKey) {
    const office = byKey[key]; const p = pathTo(office, destKey); if (!p) return null;
    let cum = 0; const hops = [{ node: office, edge: null, ms: 0, cum: 0 }];
    p.edges.forEach((e, i) => {
      const from = p.seq[i], dir = from === e.a ? 0 : 1, L = traffic.engine.links.get(e.id * 2 + dir);
      const queueMs = L ? (L.qGbit / L.cap) * 1000 : 0, txMs = L ? (OFFICE_GBIT / L.cap) * 1000 : 0; // the office's own (small) parcel
      const ms = edgeDelayMs(e) + queueMs + txMs; cum += ms;
      hops.push({ node: G.nodes[p.seq[i + 1]], edge: e, ms, cum, queue: L ? L.qGbit / Math.max(1e-9, L.bufGbit) : 0, load: e.util || 0 });
    });
    const m = measured[key + '|' + destKey];
    return { office, dest: destKey, label: DESTS[destKey].label, path: p, hops, far: p.far || null, friend: p.friend || null, ixp: p.ixp || null, cable: p.cable || null, viaChina: !!p.viaChina, fate: p.fate, measuredMs: m && m.n >= 3 ? m.avg : null };
  }

  return { OFFICES: G.OFFICES, byKey, getPath, pathTo, getFlowsFrom, traceroute, spawn, cableFor };
}

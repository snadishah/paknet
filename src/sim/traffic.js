// Traffic on the discrete-event engine: a generator that offers load by time
// of day, measured metrics, and the positions of visible bundles for drawing.
// Pure: no three.js rendering, no DOM. Bundles carry CSS colour strings.
//
// NOTE (step 3 of docs/PLAN.md): a bundle's path is fixed when it is injected,
// from the current routing view (stale during "convergence"). Hop-by-hop
// forwarding from per-router tables arrives with the real protocols (steps 4–6).
import { FLOW } from '../palette.js';
import { state } from '../state.js';
import { KM_PER_UNIT } from '../geo/projection.js';
import { buildPath } from '../routing/paths.js';
import { createEngine } from './engine.js';
import {
  propDelayMs, GEO_HOP_MS, BUNDLE_GBIT, TIME_SCALE_MS, PEAK_OFFERED_TBPS, CLASS_SHARE, BUFFER_MS,
  PROBE_EVERY_MS, CABLE_GBPS, GWADAR_CABLE_GBPS, EDGE_GBPS, FIBRE_GBPS_PER_OPERATOR, GRAVITY_EXPONENT, MIN_POP, ACCESS_GBPS_PER_PERSON
} from './params.js';

export const MAXP = 4000; // most bundles drawn at once (the simulation itself has no cap)

// Share of peak demand by hour of day (0.3 at night, 1.0 in the evening).
export function diurnal(h) {
  h = ((h % 24) + 24) % 24;
  if (h >= 5 && h <= 22) return 0.3 + 0.7 * (1 - Math.cos(Math.PI * (h - 5) / 17)) / 2;
  const t = ((h - 22 + 24) % 24) / 7; return 0.3 + 0.7 * (1 + Math.cos(Math.PI * t)) / 2;
}

// Capacity of an edge per direction, in Gbps (sources in params.js).
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
export const edgeDelayMs = e => (e.type === 'sat' ? GEO_HOP_MS : propDelayMs(e.len * KM_PER_UNIT));

const VIS_CAT = { intl: 'intl', china: 'intl', border: 'intl', dom: 'dom', cdn: 'cdn', sat: 'sat', atk: 'atk', loop: 'loop' };
const INTL_CLASSES = ['intl', 'china', 'border'];

export function createTraffic(G, net) {
  const { N, INTL, DCS, GW, VSAT, adj, edges, plannedEdges } = G;
  const flags = { satellite: false };
  const stats = { cat: {} }; // delivered bundles per visual category (decays; for the traffic mix)
  const eng = createEngine({ capacityGbps: e => edgeCapacityGbps(G, e), delayMs: edgeDelayMs, usable: e => net.usable(e), bufferMs: BUFFER_MS });

  /* ---------- injecting bundles ---------- */
  function send(path, cls, opt = {}) {
    if (!path || !path.edges.length) return null;
    const b = eng.inject(path.seq, path.edges, { gbit: BUNDLE_GBIT, ...opt, cls });
    b.color = opt.color || FLOW[VIS_CAT[cls] || 'dom'].c;
    b.size = opt.size || (cls === 'atk' ? 0.12 : 0.085);
    b.visible = cls !== 'probe';
    return b;
  }
  // Compatibility with scenarios: emitPacket(path, category, { color, size, sink, blackhole, blocked, probe }).
  const emitPacket = (path, cat, opt = {}) => send(path, cat, opt.probe || cat === 'loop' ? { ...opt, gbit: 1e-6 } : opt);

  /* ---------- the generator ---------- */
  const srcPool = G.nodes.filter(n => n.kind === 'city' && n.name !== 'Khunjerab Pass');
  const srcW = srcPool.map(n => Math.pow(Math.max(n.pop, MIN_POP), GRAVITY_EXPONENT)); const srcTot = srcW.reduce((a, b) => a + b, 0);
  function pickCity() { let r = Math.random() * srcTot; for (let i = 0; i < srcPool.length; i++) { r -= srcW[i]; if (r <= 0) return srcPool[i]; } return srcPool[0]; }

  // Pick a live cable direction, weighted by capacity (operators balance load roughly this way).
  function pickCableEdge() {
    const live = []; for (const c of net.liveCables()) for (const e of c.edges) if (!e.cut) live.push([e, edgeCapacityGbps(G, e) * (e.dir === 'W' ? 1.6 : e.dir === 'E' ? 0.9 : 0.8)]);
    if (state.plannedActive) live.push([plannedEdges[0], GWADAR_CABLE_GBPS]);
    if (!live.length) return null; const tot = live.reduce((a, b) => a + b[1], 0); let r = Math.random() * tot; for (const [e, w] of live) { r -= w; if (r <= 0) return e; } return live[0][0];
  }

  const join = (a, b) => (a && b ? { seq: [...a.seq, ...b.seq.slice(1)], edges: [...a.edges, ...b.edges] } : null);
  const rev = p => (p ? { seq: [...p.seq].reverse(), edges: [...p.edges].reverse() } : null);
  const hop = (u, e) => ({ seq: [u, e.a === u ? e.b : e.a], edges: [e] });
  const CLASSES = Object.entries(CLASS_SHARE), SHARE_SUM = CLASSES.reduce((a, [, w]) => a + w, 0);

  function spawnOne() {
    const now = performance.now();
    const stale = now < state.convergeUntil && Math.random() < 0.55 * (state.convergeUntil - now) / (state.convergeUntil - state.convergeStart);
    const route = (a, b, st = false) => net.route(a, b, st);
    let r = Math.random() * SHARE_SUM, cls = CLASSES[CLASSES.length - 1][0];
    for (const [k, w] of CLASSES) { if (r < w) { cls = k; break; } r -= w; }
    if (cls === 'intl') {
      const src = pickCity(); let ce = pickCableEdge();
      if (stale && state.staleSet.size) { const c = edges[[...state.staleSet][Math.floor(Math.random() * state.staleSet.size)]]; if (c.cable) ce = c; }
      if (!ce) return send(route(src.id, INTL.N.id), 'intl'); // no cables left: China fibre is the only way out
      const full = join(route(src.id, ce.a, stale), hop(ce.a, ce));
      return send(Math.random() < 0.62 ? rev(full) : full, 'intl'); // most international traffic is inbound
    }
    if (cls === 'dom') { const a = pickCity(), b = pickCity(); return a !== b && send(route(a.id, b.id, stale), 'dom'); }
    if (cls === 'cdn') {
      const a = pickCity(); let best = DCS[0], bd = 1e9; for (const d of DCS) { const dd = d.pos.distanceTo(a.pos); if (dd < bd) { bd = dd; best = d; } }
      return send(rev(route(a.id, best.id)), 'cdn');
    }
    if (cls === 'sat') {
      if (!flags.satellite) return null;
      const v = VSAT[Math.floor(Math.random() * VSAT.length)], g = GW[Math.floor(Math.random() * GW.length)];
      const up = adj.get(v.id).find(e => e.type === 'sat'), down = adj.get(g.id).find(e => e.type === 'sat');
      const p = { seq: [v.id, G.SAT.id, g.id], edges: [up, down] };
      return send(Math.random() < 0.5 ? p : rev(p), 'sat');
    }
    if (cls === 'china') {
      const src = [N('Islamabad'), N('Rawalpindi'), N('Lahore'), N('Gilgit'), N('Peshawar')][Math.floor(Math.random() * 5)];
      const p = route(src.id, INTL.N.id); return send(Math.random() < 0.5 ? p : rev(p), 'china');
    }
    const [a, b] = [[N('Peshawar'), INTL.AF], [N('Quetta'), INTL.AFS], [N('Quetta'), INTL.IR]][Math.floor(Math.random() * 3)];
    const p = route(a.id, b.id); return send(Math.random() < 0.5 ? p : rev(p), 'border');
  }

  /* ---------- latency probes: Karachi ↔ Lahore ---------- */
  const probe = { kl: [], lk: [], last: null, next: 0 };
  function sendProbes() {
    const k = N('Karachi').id, l = N('Lahore').id;
    const p1 = send(net.route(k, l), 'probe', { gbit: 1e-6, dir: 'kl' }), p2 = send(net.route(l, k), 'probe', { gbit: 1e-6, dir: 'lk' });
    void p1; void p2;
  }

  /* ---------- delivery and loss ---------- */
  let cb = null; // { drop(b), arrive(b) } from the caller, for bursts
  const intlGbit = { in: 0, out: 0 }; // delivered international traffic by direction
  // Loss is measured on legitimate traffic: attack bundles dying at their target
  // aren't "loss", but hijacked users' traffic (blackholed) is.
  const legit = { delivered: 0, dropped: 0 };
  const isLegit = b => b.opt.blackhole || !['atk', 'probe', 'loop'].includes(b.cls);
  eng.hooks.deliver = b => {
    if (b.cls === 'probe') { probe[b.opt.dir].push(b.delay); return; }
    if (isLegit(b)) legit[b.opt.blackhole ? 'dropped' : 'delivered']++;
    if (INTL_CLASSES.includes(b.cls) && !b.opt.blackhole) intlGbit[G.nodes[b.seq[0]].tier === 'intl' ? 'in' : 'out'] += b.gbit;
    const cat = VIS_CAT[b.cls]; if (cat && cat !== 'atk' && cat !== 'loop') stats.cat[cat] = (stats.cat[cat] || 0) + 1;
    if (b.visible) { place(b); cb?.arrive(b); }
  };
  eng.hooks.drop = b => { if (isLegit(b)) legit.dropped++; if (b.visible) { place(b); cb?.drop(b); } };

  /* ---------- geometry for drawing ---------- */
  const geo = new Map(); // directed edge → polyline
  function hopGeometry(b, h) {
    const e = b.edges[Math.min(h, b.edges.length - 1)], from = b.seq[Math.min(h, b.edges.length - 1)];
    const key = e.id * 2 + (from === e.a ? 0 : 1);
    let g = geo.get(key); if (!g) { g = buildPath(from, [e]); geo.set(key, g); }
    return g;
  }
  // Set b.path / b.d (distance along the current hop) for drawing and bursts.
  function place(b) {
    if (b.state === 'done') { b.path = hopGeometry(b, b.edges.length - 1); b.d = b.path.total; return; }
    const h = Math.min(b.hop, b.edges.length - 1); b.path = hopGeometry(b, h);
    if (b.state === 'wire' && b.link) b.d = b.path.total * Math.min(1, (eng.now - b.tWire) / Math.max(1e-6, b.link.prop));
    else if (b.state === 'queued' && b.link) b.d = Math.min(b.path.total * 0.25, 0.012 + b.link.queue.indexOf(b) * 0.006);
    else if (b.state === 'dropped' && b.why === 'down' && b.tWire != null && b.link) b.d = b.path.total * Math.min(1, (eng.now - b.tWire) / Math.max(1e-6, b.link.prop));
    else b.d = 0;
  }
  const packets = [];
  function refreshVisible() {
    packets.length = 0;
    for (const b of eng.bundles) { if (!b.visible) continue; place(b); packets.push(b); if (packets.length >= MAXP) break; }
  }

  /* ---------- the clock ---------- */
  let carry = 0;
  // Advance by sdt wall seconds (already scaled by playback speed).
  function advance(sdt, callbacks) {
    cb = callbacks;
    const t0 = eng.now, dt = sdt * TIME_SCALE_MS, t1 = t0 + dt;
    if (dt > 0) {
      // offered load → bundle arrivals spread evenly through this slice of network time
      carry += PEAK_OFFERED_TBPS * diurnal(state.simHour) / BUNDLE_GBIT * dt; // bundles per ms = Tbps / Gbit
      const k = Math.floor(carry); carry -= k;
      for (let i = 0; i < k; i++) { eng.run(t0 + dt * (i + Math.random()) / k); spawnOne(); }
      while (probe.next <= t1) { eng.run(Math.max(eng.now, probe.next)); sendProbes(); probe.next += PROBE_EVERY_MS; }
      eng.run(t1);
    }
    refreshVisible();
  }

  /* ---------- measurement ---------- */
  const last = { t: 0, delivered: 0, dropped: 0, in: 0, out: 0, busy: new Map() };
  // Metrics since the previous call. Returns null if no network time has passed.
  function sample() {
    const dt = eng.now - last.t; if (dt <= 0) return null;
    const inTbps = (intlGbit.in - last.in) / dt, outTbps = (intlGbit.out - last.out) / dt; // Gbit per ms = Tbps
    const dDel = legit.delivered - last.delivered, dDrop = legit.dropped - last.dropped;
    // link utilisation and queue occupancy. Busy time counts the transmission in
    // progress too, so slow links read correctly over short windows.
    for (const e of edges) { e.util = 0; e.qfrac = 0; }
    const nodeQ = new Map();
    for (const L of eng.links.values()) {
      const busyNow = L.busyMs + (L.busy ? eng.now - L.busy.tTx : 0);
      const u = Math.min(1, (busyNow - (last.busy.get(L.key) || 0)) / dt); last.busy.set(L.key, busyNow); L.util = u;
      const q = L.bufGbit > 0 ? L.qGbit / L.bufGbit : 0;
      if (u > L.e.util) L.e.util = u; if (q > L.e.qfrac) L.e.qfrac = q;
      const from = L.dir === 0 ? L.e.a : L.e.b; nodeQ.set(from, Math.max(nodeQ.get(from) || 0, q));
    }
    const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const kl = mean(probe.kl), lk = mean(probe.lk); probe.kl.length = probe.lk.length = 0;
    if (kl != null && lk != null) probe.last = kl + lk;
    const out = {
      elapsedMs: dt,
      // capacity is quoted per direction, so throughput is the busier direction (inbound, usually)
      intlTbps: Math.max(inTbps, outTbps), intlInTbps: inTbps, intlOutTbps: outTbps,
      lossPct: dDel + dDrop ? dDrop / (dDel + dDrop) * 100 : 0,
      rttMs: probe.last, nodeQ
    };
    last.t = eng.now; last.delivered = legit.delivered; last.dropped = legit.dropped; last.in = intlGbit.in; last.out = intlGbit.out;
    return out;
  }

  // Lit international capacity of the links currently usable, in Tbps.
  function intlCapacityTbps() {
    let g = 0;
    for (const c of G.CABLES) for (const e of c.edges) if (net.usable(e)) g += edgeCapacityGbps(G, e);
    if (state.plannedActive && net.usable(plannedEdges[0])) g += GWADAR_CABLE_GBPS;
    const ofc = adj.get(INTL.N.id)[0]; if (ofc && net.usable(ofc)) g += edgeCapacityGbps(G, ofc);
    return g / 1000;
  }

  const onCut = e => eng.cut(e);

  return { engine: eng, packets, stats, flags, emitPacket, pickCity, pickCableEdge, advance, sample, intlCapacityTbps, onCut };
}

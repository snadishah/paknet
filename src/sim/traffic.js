// Traffic generator and packet movement. Pure: packets carry a CSS colour
// string; the renderer turns it into GPU colours.
// NOTE: still the proof-of-concept model (packets animate along precomputed
// paths). Step 3 of docs/PLAN.md replaces this with the discrete-event model.
import { FLOW } from '../palette.js';
import { state } from '../state.js';
import { buildPath, concatPaths, reversePath } from '../routing/paths.js';

export const MAXP = 1600;

// Share of peak demand by hour of day (0.3 at night, 1.0 in the evening).
export function diurnal(h) {
  h = ((h % 24) + 24) % 24;
  if (h >= 5 && h <= 22) return 0.3 + 0.7 * (1 - Math.cos(Math.PI * (h - 5) / 17)) / 2;
  const t = ((h - 22 + 24) % 24) / 7; return 0.3 + 0.7 * (1 + Math.cos(Math.PI * t)) / 2;
}

export function createTraffic(G, net) {
  const { N, INTL, DCS, GW, VSAT, adj, edges, plannedEdges } = G;
  const packets = [];
  const stats = { cat: {}, cableLoad: {}, sent: 0, dropped: 0 };
  const flags = { satellite: false };

  function emitPacket(path, cat, opt = {}) {
    if (!path || packets.length >= MAXP) return null;
    let dropAt = null; for (const [d, e] of path.edgeStarts) if (e.cut) { dropAt = d + e.len * 0.5; break; }
    const pk = { path, d: 0, v: (opt.speed || 2.2) * (0.85 + Math.random() * 0.3), color: opt.color || FLOW[cat].c, cat, size: opt.size || (cat === 'atk' ? 0.12 : 0.085), dropAt, sink: opt.sink };
    packets.push(pk); stats.sent++; stats.cat[cat] = (stats.cat[cat] || 0) + 1;
    for (const [, e] of path.edgeStarts) { e.load += 1; if (e.cable) stats.cableLoad[e.cable.id] = (stats.cableLoad[e.cable.id] || 0) + 1; }
    return pk;
  }

  const srcPool = G.nodes.filter(n => n.kind === 'city' && n.name !== 'Khunjerab Pass');
  const srcW = srcPool.map(n => Math.pow(Math.max(n.pop, 15000), 0.78)); const srcTot = srcW.reduce((a, b) => a + b, 0);
  function pickCity() { let r = Math.random() * srcTot; for (let i = 0; i < srcPool.length; i++) { r -= srcW[i]; if (r <= 0) return srcPool[i]; } return srcPool[0]; }

  function pickCableEdge() {
    const live = []; for (const c of net.liveCables()) for (const e of c.edges) if (!e.cut) live.push([e, c.share * (e.dir === 'W' ? 1.6 : e.dir === 'E' ? 0.9 : 0.8)]);
    if (state.plannedActive) live.push([plannedEdges[0], 0.12]);
    if (!live.length) return null; const tot = live.reduce((a, b) => a + b[1], 0); let r = Math.random() * tot; for (const [e, w] of live) { r -= w; if (r <= 0) return e; } return live[0][0];
  }

  function spawnNormal() {
    const r = Math.random(), now = performance.now();
    const stale = now < state.convergeUntil && Math.random() < 0.55 * (state.convergeUntil - now) / (state.convergeUntil - state.convergeStart);
    const { route } = net;
    if (r < 0.62) {
      const src = pickCity(); let ce = pickCableEdge();
      if (stale && state.staleSet.size) { const c = edges[[...state.staleSet][Math.floor(Math.random() * state.staleSet.size)]]; if (c.cable) ce = c; }
      if (!ce) { const p = route(src.id, INTL.N.id); if (p) emitPacket(Math.random() < 0.5 ? p : reversePath(p), 'intl'); return; }
      const p1 = route(src.id, ce.a, stale); if (!p1) return;
      const full = concatPaths(p1, buildPath(ce.a, [ce])); emitPacket(Math.random() < 0.62 ? reversePath(full) : full, 'intl');
    } else if (r < 0.76) {
      const a = pickCity(), b = pickCity(); if (a !== b) emitPacket(route(a.id, b.id, stale), 'dom');
    } else if (r < 0.88) {
      const a = pickCity(); let best = DCS[0], bd = 1e9; for (const d of DCS) { const dd = d.pos.distanceTo(a.pos); if (dd < bd) { bd = dd; best = d; } }
      const p = route(a.id, best.id); if (p) emitPacket(reversePath(p), 'cdn');
    } else if (r < 0.93) {
      if (!flags.satellite) return;
      const v = VSAT[Math.floor(Math.random() * VSAT.length)], g = GW[Math.floor(Math.random() * GW.length)];
      const p = buildPath(v.id, [adj.get(v.id).find(e => e.type === 'sat'), adj.get(g.id).find(e => e.type === 'sat')]); emitPacket(Math.random() < 0.5 ? p : reversePath(p), 'sat', { speed: 4 });
    } else if (r < 0.97) {
      const src = [N('Islamabad'), N('Rawalpindi'), N('Lahore'), N('Gilgit'), N('Peshawar')][Math.floor(Math.random() * 5)];
      const p = route(src.id, INTL.N.id); if (p) emitPacket(Math.random() < 0.5 ? p : reversePath(p), 'intl');
    } else {
      const [a, b] = [[N('Peshawar'), INTL.AF], [N('Quetta'), INTL.AFS], [N('Quetta'), INTL.IR]][Math.floor(Math.random() * 3)];
      const p = route(a.id, b.id); if (p) emitPacket(Math.random() < 0.5 ? p : reversePath(p), 'intl');
    }
  }

  // After a cut, packets already in flight drop when they reach the break.
  function markInFlightDrops() {
    for (const pk of packets) if (pk.dropAt === null) for (const [d, e] of pk.path.edgeStarts) if (e.cut && d + e.len * 0.5 > pk.d) { pk.dropAt = d + e.len * 0.5; break; }
  }

  // Move packets by sdt (scaled seconds). cb.drop(pk) / cb.arrive(pk) fire before removal.
  function advance(sdt, cb) {
    for (let i = packets.length - 1; i >= 0; i--) {
      const pk = packets[i]; pk.d += pk.v * sdt;
      if (pk.dropAt !== null && pk.d >= pk.dropAt) { stats.dropped++; cb.drop(pk); packets.splice(i, 1); continue; }
      if (pk.d >= pk.path.total) { cb.arrive(pk); packets.splice(i, 1); }
    }
  }

  return { packets, stats, flags, emitPacket, pickCity, pickCableEdge, spawnNormal, markInFlightDrops, advance };
}

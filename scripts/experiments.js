// Headless experiments for the report. Bundled and run by scripts/experiment.mjs
// (`npm run experiment`). Random numbers are seeded, so every run gives the
// same numbers. Writes docs/results/results.json.
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildTopology } from '../src/graph/topology.js';
import { createNetwork } from '../src/sim/network.js';
import { createTraffic } from '../src/sim/traffic.js';
import { createMapeK } from '../src/defence/mapek.js';
import { createDV, INFINITY } from '../src/routing/dv.js';
import { createInterdomain } from '../src/sim/interdomain.js';
import { state } from '../src/state.js';
import { TIME_SCALE_MS, DEFENCE, CABLE_GBPS } from '../src/sim/params.js';

// mulberry32: a small, well-known seeded generator
function seed(s) { Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const quiet = { drop() {}, arrive() {} };
const STEP = 1 / 60;
const out = { generated: new Date().toISOString(), seed: 42, timeScaleMs: TIME_SCALE_MS };
const log = (...a) => console.log('  ', ...a);

function world(protocol = 'OSPF', hour = 21) {
  Object.assign(state, { simHour: hour, plannedActive: false, convergeUntil: 0, staleSet: new Set(), protocol, defense: false });
  const G = buildTopology(), net = createNetwork(G), traffic = createTraffic(G, net);
  return { G, net, traffic };
}
function run(w, ms, each) { for (let t = 0; t < ms; t += STEP * TIME_SCALE_MS) { each?.(STEP); w.traffic.advance(STEP, quiet); } }
function measure(w, warm = 20, ms = 30) { run(w, warm); w.traffic.sample(); run(w, ms); return w.traffic.sample(); }
const r2 = x => (x == null ? null : Math.round(x * 100) / 100);
const cable = (w, id) => w.G.CABLES.find(c => c.id === id);
const edgeBetween = (G, a, b) => G.adj.get(G.N(a).id).find(e => e.type !== 'access' && [G.nodes[e.a].name, G.nodes[e.b].name].includes(b));

/* ---------- E1: a day ---------- */
console.log('E1 daily cycle');
seed(42);
{
  const w = world(); out.daily = [];
  for (const h of [0, 3, 6, 9, 12, 15, 18, 21]) {
    state.simHour = h; const m = measure(w, 15, 30);
    out.daily.push({ hour: h, intlTbps: r2(m.intlTbps), lossPct: r2(m.lossPct), rttMs: r2(m.rttMs) }); log(h, out.daily.at(-1));
  }
}

/* ---------- E2: cable cuts at 21:00 ---------- */
console.log('E2 cable cuts');
out.cuts = [];
for (const [label, ids, spare] of [['No cuts', []], ['AAE-1 (Jan 2025)', ['AAE1']], ['AAE-1 + spare capacity on IMEWE, SMW4', ['AAE1'], true], ['SMW4 + IMEWE (Sep 2025)', ['SMW4', 'IMEWE']], ['PEACE (Oct 2025)', ['PEACE']], ['Every Karachi cable', ['SMW4', 'IMEWE', 'AAE1', 'SMW5', 'TW1', 'SMW6', 'PEACE']]]) {
  seed(42);
  const saved = { IMEWE: CABLE_GBPS.IMEWE, SMW4: CABLE_GBPS.SMW4 };
  if (spare) { CABLE_GBPS.IMEWE = 2760; CABLE_GBPS.SMW4 = 2580; }
  const w = world(); run(w, 20);
  const es = ids.flatMap(id => cable(w, id).edges); es.forEach(e => { w.net.cutEdge(e); w.traffic.onCut(e); }); w.net.topologyChanged(es, 'OSPF');
  const m = measure(w, 10, 30);
  out.cuts.push({ label, capTbps: r2(w.traffic.intlCapacityTbps()), intlTbps: r2(m.intlTbps), lossPct: r2(m.lossPct), rttMs: r2(m.rttMs) }); log(out.cuts.at(-1));
  Object.assign(CABLE_GBPS, saved);
}

/* ---------- E3: RIP count-to-infinity ---------- */
console.log('E3 RIP');
{
  const G = buildTopology(); const usable = e => !e.cut && e.type !== 'planned' && !(e.cable && e.cable.status !== 'live');
  const cut = () => edgeBetween(G, 'Nok Kundi', 'Taftan');
  out.rip = {};
  for (const [name, opts] of [['none', {}], ['splitHorizon', { splitHorizon: true }], ['poisonReverse', { poisonReverse: true }]]) {
    G.edges.forEach(e => (e.cut = false));
    const dv = createDV(G, { usable, ...opts }); const initialRounds = dv.converge(); const start = dv.round;
    cut().cut = true; const nk = [], dal = [];
    for (let r = 0; r < 25; r++) { dv.step(); nk.push(dv.distance(G.N('Nok Kundi').id, G.N('Taftan').id)); dal.push(dv.distance(G.N('Dalbandin').id, G.N('Taftan').id)); }
    out.rip[name] = { initialRounds, roundsToConverge: dv.lastChange - start, nokKundi: nk, dalbandin: dal, maxBogus: Math.max(0, ...nk.filter(x => x < INFINITY)) };
    log(name, out.rip[name].roundsToConverge, 'rounds; NK', nk.join(','));
  }
}

/* ---------- E4: OSPF convergence and the black hole ---------- */
console.log('E4 OSPF');
out.ospf = [];
for (const [label, a, b] of [['KKH: Chilas–Gilgit', 'Chilas', 'Gilgit'], ['Karachi–Hyderabad', 'Karachi', 'Hyderabad'], ['Rawalpindi–Islamabad', 'Rawalpindi', 'Islamabad'], ['Quetta–Sibi', 'Quetta', 'Sibi']]) {
  for (const detect of ['carrier', 'hello']) {
    seed(42);
    const w = world('OSPF'); w.net.ls.opts.detect = detect; run(w, 10);
    let conv = null; w.net.ls.hooks.converged = r => (conv = r);
    const e = edgeBetween(w.G, a, b); const down0 = w.traffic.engine.counters.droppedBy.down;
    w.net.cutEdge(e); w.traffic.onCut(e); w.net.topologyChanged([e], 'OSPF');
    // OSPF and packets advance together on their own compressed clocks, as in the app
    for (let i = 0; i < 20000 && !conv; i++) { w.net.lsAdvance(STEP); w.traffic.advance(STEP, quiet); }
    const lost = w.traffic.engine.counters.droppedBy.down - down0;
    out.ospf.push({ label, detect, totalMs: r2(conv.totalMs), detectMs: r2(conv.detectMs), floodMs: r2(conv.floodMs), routers: conv.routersUpdated, blackholedBundles: lost });
    log(out.ospf.at(-1));
  }
}

/* ---------- E5: the 2008 hijack in BGP ---------- */
console.log('E5 BGP');
{
  const T = { start: 0, yt24: 79 * 60000 + 40000, yt25: 90 * 60000 + 58000, pccw: 131 * 60000 + 54000 };
  const id = createInterdomain(); id.startManual({ start: '18:47:45' });
  let conv = null; id.bgp.hooks.converged = r => (conv = r);
  const snap = (step, utc) => ({ step, utc, world: r2(id.worldHijackedShare()), pakistan: r2(id.pkBlockedShare()) });
  out.hijack = { replay: [snap('Before', '18:47:45')] };
  id.act('ptclAnnounce'); id.settle(); out.hijack.leak = { convergenceMs: conv?.ms, updates: conv?.updates };
  out.hijack.replay.push(snap('PTCL announces /24', id.utc()));
  id.jumpTo(T.yt24); id.act('ytSame24'); id.settle(); out.hijack.replay.push(snap('YouTube announces /24', id.utc()));
  id.jumpTo(T.yt25); id.act('yt25s'); id.settle(); out.hijack.replay.push(snap('YouTube announces /25s', id.utc()));
  id.jumpTo(T.pccw); id.act('pccwFilter'); id.settle(); out.hijack.replay.push(snap('PCCW filters PTCL', id.utc()));
  // what-ifs
  const fixes = [];
  for (const [label, setup] of [['PTCL export filter in place', i => i.bgp.originate(17557, '208.65.153.0/24', { exportTo: 'none' })], ['PCCW customer prefix filter', i => { i.bgp.setPolicy(3491, { customerFilter: true }); i.settle(); i.act('ptclAnnounce'); }], ['ROV at the carriers from the start', i => { for (const c of [3491, 3356, 1299, 174]) i.bgp.setPolicy(c, { rov: true }); i.settle(); i.act('ptclAnnounce'); }]]) {
    const j = createInterdomain(); j.startManual({ start: '18:47:45' }); setup(j); j.settle(); fixes.push({ label, world: r2(j.worldHijackedShare()), pakistan: r2(j.pkBlockedShare()) });
  }
  const k = createInterdomain(); k.startManual({ start: '18:47:45' }); k.act('ptclAnnounce'); k.settle(); const hit = k.worldHijackedShare();
  k.deployRov(DEFENCE.rovDeployMs); while (k.bgp.busy) k.bgp.advance(k.bgp.now + 1000);
  fixes.push({ label: `Adaptive defence: ROV deployed ${DEFENCE.rovDeployMs / 60000} min after detection`, world: r2(k.worldHijackedShare()), pakistan: r2(k.pkBlockedShare()), containedUtc: k.utc(), peakWorld: r2(hit) });
  out.hijack.fixes = fixes; log(out.hijack);
}

/* ---------- E6: the adaptive defence ---------- */
console.log('E6 defence');
function defenceRun(on, attack) {
  seed(42);
  const w = world('OSPF'); const acted = [];
  const d = createMapeK({ protect: new Set(w.G.DCS.filter(x => !x.scrub).map(x => x.id)), rov: () => 'notfound', params: DEFENCE, effectors: { divert: x => acted.push(['divert', x, w.traffic.engine.now]), quarantine: x => acted.push(['quarantine', x, w.traffic.engine.now]), deployRov: () => {} } });
  d.enabled = on; w.traffic.telemetry.onInject = (b, t) => d.observeFlow(b, t);
  run(w, 15, () => d.tick(w.traffic.engine.now)); w.traffic.sample();
  const t0 = w.traffic.engine.now, series = []; let nextSample = t0 + 1, nextBeacon = t0;
  const target = w.G.DCS[1], scrub = w.G.DCS.find(x => x.scrub), mardan = w.G.N('Mardan');
  run(w, attack === 'ddos' ? 30 : 20, s => {
    d.tick(w.traffic.engine.now);
    if (attack === 'ddos') {
      const dst = acted.length ? scrub : target;
      for (let i = 0; i < 8 * TIME_SCALE_MS / 0.1 * s; i++) { const ce = w.traffic.pickCableEdge(); const p = w.net.route(dst.id, ce.a); w.traffic.emitPacket({ seq: [ce.b, ...[...p.seq].reverse()], edges: [ce, ...[...p.edges].reverse()] }, 'atk', { sink: true }); }
      for (let i = 0; i < 0.8 * TIME_SCALE_MS / 0.1 * s; i++) { const p = w.net.route(w.traffic.pickCity().id, dst.id); if (p) w.traffic.emitPacket(p, 'atk', { sink: true }); }
    } else {
      while (nextBeacon <= w.traffic.engine.now) {
        nextBeacon += 0.1; const ce = w.traffic.pickCableEdge(); const cls = w.G.nodes[ce.a].tier === 'intl' ? ce.b : ce.a; const p = w.net.route(mardan.id, cls);
        w.traffic.emitPacket({ seq: [...p.seq, ce.a === cls ? ce.b : ce.a], edges: [...p.edges, ce] }, 'atk', { dstAddr: 'c2-server', blocked: acted.length > 0 });
      }
    }
    if (w.traffic.engine.now >= nextSample) { const m = w.traffic.sample(); series.push({ t: r2(w.traffic.engine.now - t0), lossPct: r2(m.lossPct), rttMs: r2(m.rttMs) }); nextSample += 1; }
  });
  const det = d.log.find(e => e.phase === 'analyse'), exe = d.log.find(e => e.phase === 'execute');
  const loss = series.map(x => x.lossPct);
  return { on, detectMs: det ? r2(det.t - t0) : null, responseMs: exe ? r2(exe.t - t0) : null, peakLossPct: r2(Math.max(...loss)), meanLossPct: r2(loss.reduce((a, b) => a + b, 0) / loss.length), series, analysis: det?.text };
}
out.defence = { ddos: { off: defenceRun(false, 'ddos'), on: defenceRun(true, 'ddos') }, beacon: defenceRun(true, 'beacon') };
log('ddos off', out.defence.ddos.off.peakLossPct, out.defence.ddos.off.meanLossPct, '| on', out.defence.ddos.on.peakLossPct, out.defence.ddos.on.meanLossPct, out.defence.ddos.on.detectMs, out.defence.ddos.on.responseMs);
log('beacon', out.defence.beacon.detectMs, out.defence.beacon.analysis);
{ // false positives: a normal evening with the loop watching
  seed(42); const w = world('OSPF'); const alarms = [];
  const d = createMapeK({ protect: new Set(w.G.DCS.filter(x => !x.scrub).map(x => x.id)), rov: () => 'notfound', params: DEFENCE, effectors: { divert: () => alarms.push('divert'), quarantine: () => alarms.push('quarantine'), deployRov: () => {} } });
  w.traffic.telemetry.onInject = (b, t) => d.observeFlow(b, t);
  run(w, 100, () => d.tick(w.traffic.engine.now));
  out.defence.falsePositives = { networkMs: 100, alarms: alarms.length }; log('false positives over 100 ms:', alarms.length);
}

mkdirSync('docs/results', { recursive: true });
writeFileSync('docs/results/results.json', JSON.stringify(out, null, 1));
console.log('wrote docs/results/results.json');

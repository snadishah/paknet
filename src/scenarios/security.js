// Security scenarios and the adaptive defence that answers them.
//   Hijack (2008): SIMULATED with BGP (sim/interdomain.js). The timeline only
//     performs the operator actions of the day; everything else follows from BGP.
//   DDoS and compromised phones: the attack traffic is simulated (queues, loss,
//     latency are measured).
//   Defence: a MAPE-K loop (defence/mapek.js) watches flow telemetry and BGP
//     routes. Nothing here is a timer: responses happen when the loop detects
//     something and decides. Switch defence off to see the same attack unanswered.
// Each run records loss and latency so off/on runs can be compared.
import { state } from '../state.js';
import { on, emit } from '../events.js';
import { lift } from '../geo/projection.js';
import { buildPath, concatPaths, reversePath } from '../routing/paths.js';
import { TIME_SCALE_MS, BUNDLE_GBIT, YT_WORLD_TBPS, YT_PK_TBPS, FB_PK_TBPS, FB_RETRY_TBPS, DEFENCE, SCENARIO_MS, BEACON_EVERY_MS } from '../sim/params.js';
import { AS_BY_ASN } from '../sim/interdomain.js';
import { createMapeK } from '../defence/mapek.js';
import { ui, setTab, alertFeed } from '../ui/dom.js';
import { burst, shieldAt, clearShields } from '../render/fx.js';

const PHASE_NAME = { analyse: 'Analyse', plan: 'Plan', execute: 'Execute' };

export function createSecurity(ctx) {
  const { G, net, traffic, interdomain } = ctx;
  const { N, DCS, CABLES } = G;
  const scen = state.scen;
  const now = () => traffic.engine.now;

  /* ---------- the adaptive defence ---------- */
  const defence = createMapeK({
    protect: new Set(DCS.filter(d => !d.scrub).map(d => d.id)),
    rov: (p, o) => interdomain.bgp.rov(p, o),
    params: { windowMs: DEFENCE.windowMs, planMs: DEFENCE.planMs },
    nameOf: id => G.nodes[id]?.name ?? String(id),
    effectors: {
      divert(dst) { if (scen.ddos && scen.ddos.target.id === dst) { scen.ddos.phase = 2; scen.ddos.mitigatedAt = now(); shieldAt(scen.ddos.target.city, 0.5); } },
      quarantine(src) { if (scen.mal && scen.mal.city.id === src) { scen.mal.phase = 2; scen.mal.mitigatedAt = now(); shieldAt(scen.mal.city, 0.35); } },
      deployRov() { if (scen.hijack && !scen.hijack.rovAt) { scen.hijack.rovAt = interdomain.deployRov(DEFENCE.rovDeployMs); } }
    }
  });
  defence.enabled = state.defense;
  traffic.telemetry.onInject = (b, t) => defence.observeFlow(b, t);
  defence.hooks.event = e => {
    const s = scen.ddos || scen.mal || scen.hijack;
    if (s && e.phase === 'analyse' && s.detectedAt == null) s.detectedAt = e.t;
    const when = scen.hijack ? `${interdomain.utc()} UTC · ` : '';
    alertFeed(`<b>${PHASE_NAME[e.phase]}</b> · ${when}${e.text}`, e.phase === 'execute' ? 'ok' : 'warn');
    emit('defence:phase', e);
  };
  // the BGP feed comes from vantage points outside Pakistan (like public route collectors)
  on('bgp:best', ({ asn, prefix, best }) => { if (scen.hijack && !scen.hijack.story && ['transit', 'world'].includes(AS_BY_ASN.get(asn)?.kind)) defence.observeRoute(asn, prefix, best, now()); });

  /* ---------- recording runs for the before/after comparison ---------- */
  const runs = {}; // scenario → { off, on }
  let rec = null;
  function startRecording(name) { rec = { name, defence: state.defense, t0: performance.now(), t0net: now(), series: [] }; }
  on('metrics:sample', m => { if (rec) rec.series.push({ t: (now() - rec.t0net), loss: m.lossPct, rtt: m.rttMs }); });
  function finishRecording(s) {
    if (!rec) return;
    const r = rec; rec = null;
    const loss = r.series.map(x => x.loss);
    const result = {
      ...r, detectMs: s?.detectedAt != null ? s.detectedAt - r.t0net : null, mitigateMs: s?.mitigatedAt != null ? s.mitigatedAt - r.t0net : null,
      peakLoss: Math.max(0, ...loss), meanLoss: loss.length ? loss.reduce((a, b) => a + b, 0) / loss.length : 0, extra: s?.extra
    };
    (runs[r.name] ||= {})[r.defence ? 'on' : 'off'] = result;
    emit('defence:run', { name: r.name, runs: runs[r.name] });
  }

  function stop() {
    finishRecording(scen.ddos || scen.mal || scen.hijack);
    if (scen.hijack) interdomain.stop();
    scen.hijack = scen.ddos = scen.mal = null; clearShields(); defence.reset();
  }
  function begin(name, intro) {
    stop(); setTab('security'); ui('alerts').innerHTML = '';
    defence.enabled = state.defense;
    alertFeed(intro, 'info');
    alertFeed(state.defense ? '<b>Defence on:</b> the MAPE-K loop is watching flow telemetry and BGP routes.' : '<b>Defence off:</b> nobody is watching. Run it again with defence on to compare.', 'info');
    startRecording(name);
  }

  /* ---------- 2008 hijack, from BGP ---------- */
  function runHijack() {
    begin('hijack', '<b>Replay of 24 February 2008.</b> PTCL is ordered to block YouTube in Pakistan.');
    scen.hijack = { lastReport: '' };
    burst(lift(N('Karachi').pos, 0.05), '#dc2626', 0.7, 1.4);
    if (state.defense) alertFeed('What-if with today\'s rules: YouTube\'s prefix has an RPKI record (RPKI did not exist in 2008).', 'info');
    interdomain.startHijack();
  }
  on('bgp:action', ({ label, utc }) => { if (scen.hijack && !scen.hijack.shield) alertFeed(`<b>${utc} UTC</b> · ${label}`, 'warn'); });
  on('bgp:converged', () => {
    const h = scen.hijack; if (!h || h.story) return; // stories narrate for themselves
    const w = interdomain.worldHijackedShare(), pk = interdomain.pkBlockedShare();
    const report = `${Math.round(w * 100)}|${Math.round(pk * 100)}`; if (report === h.lastReport) return; h.lastReport = report;
    alertFeed(`<b>${interdomain.utc()} UTC</b> · Routes settled: <b>${Math.round(w * 100)}%</b> of the world's YouTube users and <b>${Math.round(pk * 100)}%</b> of Pakistan's send YouTube traffic into PTCL, where it is dropped.`, w > 0 ? 'crit' : 'ok');
    if (w > 0 && h.firstHijackUtc == null) h.firstHijackUtc = interdomain.utc();
    if (h.rovAt && w === 0 && !h.shield) {
      h.shield = true; h.mitigatedAt = now(); h.extra = `world outage ${h.firstHijackUtc} → ${interdomain.utc()} UTC`;
      shieldAt(N('Karachi'), 0.6);
      alertFeed(`<b>Contained at ${interdomain.utc()} UTC:</b> the carriers drop PTCL's /24 as RPKI <i>Invalid</i>. Only Pakistan, which chose the block, still loses YouTube. In 2008 the worldwide outage lasted about two hours.`, 'ok');
      setTimeout(() => { if (scen.hijack === h) stop(); }, 2500); // the rest of the 2008 timeline no longer applies
    }
    if (interdomain.phase === 'over' && !h.done) {
      h.done = true; h.extra = 'world outage 18:47 → 20:18 UTC (until YouTube\'s /25s)';
      alertFeed('In 2008 the worldwide outage lasted about two hours (18:47 to about 21:00 UTC).', 'info');
      setTimeout(() => { if (scen.hijack === h) stop(); }, 4000);
    }
  });

  /* ---------- DDoS on the Lahore CDN edge ---------- */
  function runDDoS() {
    begin('ddos', '<b>Volumetric DDoS (illustrative):</b> 8 Tbps arrives on the cables, plus a botnet inside Pakistan, aimed at the Lahore CDN edge.');
    scen.ddos = { phase: 1, target: DCS[1], scrub: DCS.find(d => d.scrub), until: now() + SCENARIO_MS.ddos };
  }

  /* ---------- compromised phones (the link to adaptive access control) ---------- */
  function runMalware() {
    begin('mal', '<b>Compromised phones near Mardan</b> start calling a command server abroad at a fixed rhythm.');
    scen.mal = { phase: 1, city: N('Mardan'), nextBeacon: now(), until: now() + SCENARIO_MS.mal };
  }

  /* ---------- attack traffic, every frame ---------- */
  const bundles = (tbps, dt) => { const x = tbps * TIME_SCALE_MS / BUNDLE_GBIT * dt; return Math.floor(x) + (Math.random() < x % 1 ? 1 : 0); };
  const RATE = { ddosCables: 8, ddosBots: 0.8 };
  function spawn(dt) {
    defence.tick(now());
    const { emitPacket, pickCableEdge, pickCity } = traffic; const { route } = net;
    const repeat = (tbps, fn) => { for (let i = bundles(tbps, dt); i > 0; i--) fn(); };
    if (scen.hijack) {
      // YouTube traffic black-holed in Pakistan, in proportion to what BGP decided
      const k = N('Karachi');
      const ptclCables = CABLES.filter(c => c.op === 'PTCL').flatMap(c => c.edges).filter(e => net.usable(e));
      repeat(YT_WORLD_TBPS * interdomain.worldHijackedShare(), () => {
        const ce = ptclCables[Math.floor(Math.random() * ptclCables.length)]; if (!ce) return;
        emitPacket(reversePath(concatPaths(route(k.id, ce.a), buildPath(ce.a, [ce]))), 'atk', { sink: true, blackhole: true });
      });
      repeat(YT_PK_TBPS * interdomain.pkBlockedShare(), () => { const p = route(pickCity().id, k.id); if (p) emitPacket(p, 'atk', { sink: true, blackhole: true }); });
    }
    if (scen.fb) {
      // Facebook: users reach the cache at PKIX Lahore only while their network can
      // still reach Facebook's DNS servers; otherwise their lookups fail and retry
      const cache = G.IXP.find(n => n.name === 'PKIX Lahore'), k = N('Karachi'), share = interdomain.fbReachableShare();
      repeat(FB_PK_TBPS * share, () => { const p = route(cache.id, pickCity().id); if (p) emitPacket(p, 'cdn'); });
      repeat(FB_RETRY_TBPS * (1 - share), () => { const p = route(pickCity().id, k.id); if (p) emitPacket({ ...p, fate: 'unreachable' }, 'dns', { color: '#94a3b8', size: 0.06 }); });
    }
    if (scen.ddos) {
      const d = scen.ddos;
      if (now() > d.until) { alertFeed('The attack stops.', 'info'); stop(); return; }
      const tgt = d.phase === 2 ? d.scrub : d.target; // diverted traffic goes to the scrubbing centre instead
      repeat(RATE.ddosCables, () => { const ce = pickCableEdge(); if (ce) emitPacket(reversePath(concatPaths(route(tgt.id, ce.a), buildPath(ce.a, [ce]))), 'atk', { sink: true }); });
      repeat(RATE.ddosBots, () => { const a = pickCity(); const p = route(a.id, tgt.id); if (p) emitPacket(p, 'atk', { sink: true }); });
    }
    if (scen.mal) {
      const m = scen.mal;
      if (now() > m.until) { alertFeed('The scenario ends.', 'info'); stop(); return; }
      // strictly periodic beacons to one server abroad; quarantined devices are blocked at the source
      while (m.nextBeacon <= now()) {
        m.nextBeacon += BEACON_EVERY_MS * (1 + (Math.random() - 0.5) * 0.04);
        const ce = traffic.pickCableEdge(); if (!ce) break;
        const cls = G.nodes[ce.a].tier === 'intl' ? ce.b : ce.a; // landing station
        const p = concatPaths(route(m.city.id, cls), buildPath(cls, [ce]));
        if (p) emitPacket(p, 'atk', { color: '#be185d', dstAddr: 'c2-server', blocked: m.phase === 2 });
      }
    }
  }

  return { runHijack, runDDoS, runMalware, spawn, stop, defence, runs };
}

// Security scenarios.
//   Hijack (2008): SIMULATED with BGP (sim/interdomain.js). The timeline only
//     performs the operator actions of the day; which networks send YouTube
//     traffic to Pakistan, and how much traffic is black-holed, follows from BGP.
//   DDoS and compromised phones: the attack TRAFFIC is simulated (queues, loss,
//     latency are measured), but detection and response are STILL SCRIPTED (step 7).
import { state } from '../state.js';
import { on } from '../events.js';
import { lift } from '../geo/projection.js';
import { buildPath, concatPaths, reversePath } from '../routing/paths.js';
import { TIME_SCALE_MS, BUNDLE_GBIT, YT_WORLD_TBPS, YT_PK_TBPS } from '../sim/params.js';
import { ui, setTab, alertFeed } from '../ui/dom.js';
import { burst, shieldAt, clearShields } from '../render/fx.js';

export function createSecurity(ctx) {
  const { G, net, traffic, interdomain } = ctx;
  const { N, DCS, CABLES } = G;
  const scen = state.scen;
  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));

  function stop() { timers.forEach(clearTimeout); timers.length = 0; if (scen.hijack) interdomain.stop(); scen.hijack = scen.ddos = scen.mal = null; clearShields(); }

  /* ---------- 2008 hijack, from BGP ---------- */
  function runHijack() {
    stop(); setTab('security'); ui('alerts').innerHTML = '';
    scen.hijack = { rov: state.defense, lastReport: '' };
    burst(lift(N('Karachi').pos, 0.05), '#dc2626', 0.7, 1.4);
    alertFeed(state.defense
      ? '<b>What-if, today\'s rules:</b> the large carriers run route origin validation against YouTube\'s RPKI record. (RPKI did not exist in 2008.)'
      : '<b>2008 rules:</b> no RPKI, and PCCW does not filter what its customer PTCL announces. Switch defence on to replay with today\'s rules.', 'info');
    interdomain.startHijack({ rov: state.defense });
  }
  on('bgp:action', ({ label, utc }) => { if (scen.hijack) alertFeed(`<b>${utc} UTC</b> · ${label}`, 'warn'); });
  // After each wave of updates settles, say what the routes now do.
  on('bgp:converged', () => {
    const h = scen.hijack; if (!h) return;
    const w = interdomain.worldHijackedShare(), pk = interdomain.pkBlockedShare();
    const report = `${Math.round(w * 100)}|${Math.round(pk * 100)}`; if (report === h.lastReport) return; h.lastReport = report;
    const kind = w > 0 ? 'crit' : 'ok';
    alertFeed(`<b>${interdomain.utc()} UTC</b> · Routes settled: <b>${Math.round(w * 100)}%</b> of the world's YouTube users and <b>${Math.round(pk * 100)}%</b> of Pakistan's now send YouTube traffic into PTCL, where it is dropped.`, kind);
    if (h.rov && w === 0 && !h.shield) { h.shield = true; shieldAt(N('Karachi'), 0.6); alertFeed('<b>Contained:</b> the carriers drop PTCL\'s /24 as RPKI <i>Invalid</i>, so it never spreads. Only Pakistan, which chose the block, loses YouTube.', 'ok'); }
    if (interdomain.phase === 'over' && !h.done) { h.done = true; alertFeed('In 2008 the worldwide outage lasted about two hours (18:47 to about 21:00 UTC).', 'info'); later(4000, () => { scen.hijack = null; interdomain.stop(); }); }
  });

  function runDDoS() {
    stop(); setTab('security'); ui('alerts').innerHTML = ''; const dc = DCS[1]; scen.ddos = { phase: 1, target: dc, scrub: DCS[3] };
    alertFeed('Volumetric DDoS against the Lahore CDN edge (illustrative)', 'info');
    later(1500, () => alertFeed('8 Tbps flood arriving on the cables · Lahore queues filling — watch packet loss and RTT in the header', 'crit'));
    if (state.defense) {
      later(4000, () => alertFeed('<b>Detected:</b> traffic 40× normal from three cable entry points', 'warn'));
      later(6000, () => { scen.ddos.phase = 2; alertFeed('<b>Adapted:</b> attack traffic diverted to scrubbing in Karachi, clean traffic forwarded', 'ok'); shieldAt(dc.city, 0.5); });
      later(14000, () => scen.ddos = null);
    } else later(12000, () => scen.ddos = null);
  }

  function runMalware() {
    stop(); setTab('security'); ui('alerts').innerHTML = ''; const city = N('Mardan'); scen.mal = { phase: 1, city };
    alertFeed('Compromised phones near Mardan start calling an external command server', 'info');
    if (state.defense) {
      later(3000, () => alertFeed('<b>Detected:</b> periodic beaconing to an unusual network · risk 0.91', 'warn'));
      later(5000, () => { scen.mal.phase = 2; alertFeed('<b>Adapted:</b> devices quarantined, step-up authentication, server blocked at the edge', 'ok'); shieldAt(city, 0.35); });
      later(12000, () => scen.mal = null);
    } else later(11000, () => scen.mal = null);
  }

  // Attack traffic for whichever scenario is running. Rates are in Tbps (illustrative
  // volumes), turned into whole bundles per frame, so attacks load the simulated links.
  const bundles = (tbps, dt) => { const x = tbps * TIME_SCALE_MS / BUNDLE_GBIT * dt; return Math.floor(x) + (Math.random() < x % 1 ? 1 : 0); };
  const RATE = { ddosCables: 8, ddosBots: 0.8, beacons: 0.05, quarantined: 0.03 };
  function spawn(dt) {
    const { emitPacket, pickCableEdge, pickCity } = traffic; const { route } = net;
    const repeat = (tbps, fn) => { for (let i = bundles(tbps, dt); i > 0; i--) fn(); };
    if (scen.hijack) {
      // YouTube traffic black-holed in Pakistan, in proportion to what BGP decided:
      // from abroad it arrives on PTCL's cables (PTCL is the AS the leak points to)
      const k = N('Karachi');
      const ptclCables = CABLES.filter(c => c.op === 'PTCL').flatMap(c => c.edges).filter(e => net.usable(e));
      repeat(YT_WORLD_TBPS * interdomain.worldHijackedShare(), () => {
        const ce = ptclCables[Math.floor(Math.random() * ptclCables.length)]; if (!ce) return;
        emitPacket(reversePath(concatPaths(route(k.id, ce.a), buildPath(ce.a, [ce]))), 'atk', { sink: true, blackhole: true });
      });
      // …and Pakistani users' requests end at PTCL's null route in Karachi
      repeat(YT_PK_TBPS * interdomain.pkBlockedShare(), () => { const p = route(pickCity().id, k.id); if (p) emitPacket(p, 'atk', { sink: true, blackhole: true }); });
    }
    if (scen.ddos) {
      const tgt = scen.ddos.phase === 2 ? scen.ddos.scrub : scen.ddos.target;
      repeat(RATE.ddosCables, () => { const ce = pickCableEdge(); if (ce) emitPacket(reversePath(concatPaths(route(tgt.id, ce.a), buildPath(ce.a, [ce]))), 'atk', { sink: true }); });
      repeat(RATE.ddosBots, () => { const a = pickCity(); const p = route(a.id, tgt.id); if (p) emitPacket(p, 'atk', { sink: true }); });
    }
    if (scen.mal) {
      const c = scen.mal.city;
      if (scen.mal.phase === 1) repeat(RATE.beacons, () => { const ce = pickCableEdge(); if (ce) emitPacket(concatPaths(route(c.id, ce.a), buildPath(ce.a, [ce])), 'atk', { color: '#be185d' }); });
      // quarantined devices: their traffic is blocked at the source
      if (scen.mal.phase === 2) repeat(RATE.quarantined, () => { const p = route(c.id, N('Peshawar').id); if (p) emitPacket(p, 'atk', { color: '#be185d', blocked: true }); });
    }
  }

  return { runHijack, runDDoS, runMalware, spawn, stop };
}

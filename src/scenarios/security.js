// Security scenarios. The attack TRAFFIC is simulated (its effect on queues,
// loss and latency is measured), but detection and response are STILL SCRIPTED
// timers; steps 6–8 of docs/PLAN.md replace them with BGP/defence logic and stories.
import { state } from '../state.js';
import { lift } from '../geo/projection.js';
import { buildPath, concatPaths, reversePath } from '../routing/paths.js';
import { TIME_SCALE_MS, BUNDLE_GBIT } from '../sim/params.js';
import { ui, setTab, alertFeed } from '../ui/dom.js';
import { burst, shieldAt, clearShields } from '../render/fx.js';

export function createSecurity(ctx) {
  const { G, net, traffic } = ctx;
  const { N, DCS } = G;
  const scen = state.scen;
  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));

  function stop() { timers.forEach(clearTimeout); timers.length = 0; scen.hijack = scen.ddos = scen.mal = null; clearShields(); }

  function runHijack() {
    stop(); setTab('security'); ui('alerts').innerHTML = ''; const k = N('Karachi'); scen.hijack = { phase: 1 };
    alertFeed('AS17557 (PTCL) announces <code>208.65.153.0/24</code> to block YouTube inside Pakistan', 'info'); burst(lift(k.pos, 0.05), '#dc2626', 0.7, 1.4);
    later(1800, () => { alertFeed('The route leaks to upstream AS3491 (PCCW) and spreads worldwide — the /24 is more specific than YouTube\'s /22', 'crit'); scen.hijack.phase = 2; });
    later(3500, () => { scen.hijack.phase = 3; alertFeed('YouTube traffic from abroad now flows into Pakistan and is dropped', 'crit'); });
    if (state.defense) {
      // What-if: RPKI did not exist in 2008. Today the /22 has ROAs (AS43515, AS36040), so this /24 would be Invalid (REFERENCES §0 #10).
      later(5600, () => alertFeed('<b>Detected (what-if, with today\'s RPKI):</b> origin conflict — a /24 from AS17557 is <i>Invalid</i> against YouTube\'s ROAs', 'warn'));
      later(7600, () => { alertFeed('<b>Adapted:</b> upstreams drop the invalid route (route origin validation) — contained', 'ok'); scen.hijack.phase = 4; shieldAt(k, 0.6); });
      later(12500, () => scen.hijack = null);
    } else { later(7000, () => alertFeed('No defence — in 2008 the outage lasted about two hours', 'crit')); later(14000, () => scen.hijack = null); }
  }

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
  const RATE = { leakAnnounce: 0.3, hijacked: 3, ddosCables: 8, ddosBots: 0.8, beacons: 0.05, quarantined: 0.03 };
  function spawn(dt) {
    const { emitPacket, pickCableEdge, pickCity } = traffic; const { route } = net;
    const repeat = (tbps, fn) => { for (let i = bundles(tbps, dt); i > 0; i--) fn(); };
    if (scen.hijack) {
      const ph = scen.hijack.phase, k = N('Karachi');
      if (ph === 2) repeat(RATE.leakAnnounce, () => { const ce = pickCableEdge(); if (ce) emitPacket(buildPath(ce.a, [ce]), 'atk'); });
      if (ph === 3) repeat(RATE.hijacked, () => { const ce = pickCableEdge(); if (ce) emitPacket(reversePath(concatPaths(route(k.id, ce.a), buildPath(ce.a, [ce]))), 'atk', { sink: true, blackhole: true }); });
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

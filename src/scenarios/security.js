// Security scenarios. STILL SCRIPTED (timed alerts + attack packets); steps 6–8
// of docs/PLAN.md replace these with BGP/defence logic and guided stories.
import { state } from '../state.js';
import { lift } from '../geo/projection.js';
import { buildPath, concatPaths, reversePath } from '../routing/paths.js';
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
      later(5600, () => alertFeed('<b>Detected:</b> origin conflict, RPKI says invalid (only AS36561 is authorised)', 'warn'));
      later(7600, () => { alertFeed('<b>Adapted:</b> upstreams filter the bad route, YouTube announces more-specific /25s — contained', 'ok'); scen.hijack.phase = 4; shieldAt(k, 0.6); });
      later(12500, () => scen.hijack = null);
    } else { later(7000, () => alertFeed('No defence — in 2008 the outage lasted about two hours', 'crit')); later(14000, () => scen.hijack = null); }
  }

  function runDDoS() {
    stop(); setTab('security'); ui('alerts').innerHTML = ''; const dc = DCS[1]; scen.ddos = { phase: 1, target: dc, scrub: DCS[3] };
    alertFeed('Volumetric DDoS against the Lahore CDN edge (illustrative)', 'info');
    later(1500, () => alertFeed('Lahore queues full · loss 12% · latency +140 ms', 'crit'));
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

  // Attack packets for whichever scenario is running.
  function spawn(dt) {
    const { emitPacket, pickCableEdge, pickCity } = traffic; const { route } = net;
    if (scen.hijack) {
      const ph = scen.hijack.phase, k = N('Karachi');
      if (ph === 2 && Math.random() < dt * 30) { const ce = pickCableEdge(); if (ce) emitPacket(buildPath(ce.a, [ce]), 'atk', { speed: 3 }); }
      if (ph === 3 && Math.random() < dt * 60) { const ce = pickCableEdge(); if (ce) emitPacket(reversePath(concatPaths(route(k.id, ce.a), buildPath(ce.a, [ce]))), 'atk', { speed: 2.6, sink: true }); }
    }
    if (scen.ddos) {
      const tgt = scen.ddos.phase === 2 ? scen.ddos.scrub : scen.ddos.target;
      if (Math.random() < dt * 80) { const ce = pickCableEdge(); if (ce) emitPacket(reversePath(concatPaths(route(tgt.id, ce.a), buildPath(ce.a, [ce]))), 'atk', { speed: 2.6, sink: true }); }
      if (Math.random() < dt * 15) { const a = pickCity(); const p = route(a.id, tgt.id); if (p) emitPacket(p, 'atk', { sink: true }); }
    }
    if (scen.mal) {
      const c = scen.mal.city;
      if (scen.mal.phase === 1 && Math.random() < dt * 25) { const ce = pickCableEdge(); if (ce) emitPacket(concatPaths(route(c.id, ce.a), buildPath(ce.a, [ce])), 'atk', { color: '#be185d' }); }
      if (scen.mal.phase === 2 && Math.random() < dt * 10) { const p = route(c.id, N('Peshawar').id); if (p) { const pk = emitPacket(p, 'atk', { color: '#be185d' }); if (pk) pk.dropAt = 0.1; } }
    }
  }

  return { runHijack, runDDoS, runMalware, spawn, stop };
}

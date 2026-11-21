// Count-to-infinity, from the REAL distance-vector tables (routing/dv.js).
// Cutting Nok Kundi–Taftan leaves Taftan (and the Iran link behind it) with no
// other path. Without split horizon, neighbouring routers keep offering each
// other stale routes and count up to 16. Each round the panel shows what Nok
// Kundi and Dalbandin really believe, and loop bundles follow those tables.
import { on } from '../events.js';
import { state } from '../state.js';
import { INFINITY } from '../routing/dv.js';
import { ui, setTab } from '../ui/dom.js';
import { setProtocol } from '../ui/failures.js';

export function createRoutingDemos(ctx) {
  const { G, net, traffic, flyTo } = ctx;
  const { N, adj, nodes } = G;
  const A = () => N('Nok Kundi'), B = () => N('Dalbandin'), T = () => N('Taftan');
  const link = () => adj.get(A().id).find(e => e.a === T().id || e.b === T().id);
  let watch = null; // { start, quiet }

  const name = id => (id == null ? '—' : nodes[id].name);
  const cell = (r) => {
    const d = net.dv.distance(r.id, T().id), v = net.dv.nextHop(r.id, T().id);
    return `<span>${r.name} → Taftan <b>${d >= INFINITY ? '∞ (16)' : d}</b>${d < INFINITY ? ` <em>via ${name(v)}</em>` : ''}</span>`;
  };

  function countToInfinity() {
    setTab('route'); setProtocol('RIP');
    const e = link();
    if (e.cut) { net.restoreEdge(e); net.topologyChanged([]); net.dv.converge(); }
    net.dv.converge(); // start from a converged network
    net.cutEdge(e); net.topologyChanged([e], 'RIP'); flyTo('cti');
    watch = { start: net.dv.round, quiet: 0 };
    ui('cti').innerHTML = `<div class="ctirow"><span>Cut</span>${cell(A())}${cell(B())}</div>`;
  }

  on('dv:round', ({ round, changed }) => {
    ui('dvRound').textContent = state.protocol === 'RIP' ? `RIP round ${round}` : '';
    if (!watch) return;
    const k = round - watch.start;
    ui('cti').innerHTML = `<div class="ctirow"><span>Round ${k}</span>${cell(A())}${cell(B())}</div>` + ui('cti').innerHTML;
    // a few marker bundles that follow the routers' current next hops towards Taftan
    for (const src of [B(), N('Quetta')]) traffic.emitPacket(net.dvPath(src.id, T().id), 'loop', { size: 0.12 });
    watch.quiet = changed ? 0 : watch.quiet + 1;
    if (watch.quiet >= 1) {
      const rounds = Math.max(0, net.dv.lastChange - watch.start);
      ui('cti').innerHTML = `<div class="ctirow done">Converged after ${rounds} rounds (≈ ${Math.round(rounds * 0.5)} minutes of RIP time): Taftan is unreachable. ${net.dv.opts.splitHorizon || net.dv.opts.poisonReverse ? 'Split horizon stopped the two-router bounce; any count-up came from a larger loop.' : 'Try again with split horizon on.'}</div>` + ui('cti').innerHTML;
      watch = null;
    }
  });

  function restoreLink() {
    const e = link(); if (!e.cut) return;
    watch = null; net.restoreEdge(e); net.topologyChanged([]);
    ui('cti').innerHTML = '<div class="ctirow done">Link restored. Routes come back over the next rounds.</div>';
  }

  ui('dvSH').onchange = ev => net.setDVOptions({ splitHorizon: ev.target.checked });
  ui('dvPR').onchange = ev => net.setDVOptions({ poisonReverse: ev.target.checked });
  ui('btnCTIRestore').onclick = restoreLink;

  return { countToInfinity, restoreLink };
}

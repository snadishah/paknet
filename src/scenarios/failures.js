// Failure scenarios: cable cuts, the KKH landslide, the Gwadar what-if.
import { state } from '../state.js';
import { ui, note } from '../ui/dom.js';

export function createFailures(ctx) {
  const { G, net, flyTo, setLayer } = ctx;
  const { CABLES, cableEdges, edges, adj, nodes, N } = G;
  const cable = id => CABLES.find(c => c.id === id);

  function cutCable(c, on, algo = 'BGP') {
    if (on) { c.edges.forEach(net.cutEdge); note(`<b>${c.name}</b> cut — traffic moves to the remaining cables`, 'bad'); net.topologyChanged(c.edges, algo); }
    else { c.edges.forEach(net.restoreEdge); note(`<b>${c.name}</b> restored`, 'good'); net.topologyChanged([], algo); }
  }

  // Back to the real network: no cuts, no what-ifs (Gwadar, activated cables), no route highlight.
  function restoreAll() {
    edges.forEach(net.restoreEdge); net.resetConvergence();
    if (state.plannedActive) { state.plannedActive = false; setLayer('planned', false); ui('scGwadar').classList.remove('on'); }
    for (const c of CABLES) if (c.forceLive) { c.forceLive = false; c.edges.forEach(e => { e.line.material.dashed = true; e.line.material.opacity = 0.5; }); }
    ctx.route?.clearRoute();
    note('Everything restored', 'good'); net.topologyChanged([]);
  }

  const SCEN = {
    aae1: () => { cutCable(cable('AAE1'), true, 'BGP'); flyTo('karachi'); },
    // 5–6 Sep 2025: SMW4 and IMEWE cut near Jeddah; SMW5, AAE-1 and PEACE unaffected (REFERENCES §5)
    sep25: () => { const cut = [cable('SMW4'), cable('IMEWE')]; cut.forEach(c => c.edges.forEach(net.cutEdge)); note('<b>SMW4 and IMEWE</b> cut near Jeddah — SMW5, AAE-1 and PEACE keep running', 'bad'); net.topologyChanged(cut.flatMap(c => c.edges), 'BGP'); flyTo('karachi'); },
    // 20 Oct 2025: PEACE cut in the Red Sea near Sudan (REFERENCES §5)
    oct25: () => { cutCable(cable('PEACE'), true, 'BGP'); flyTo('karachi'); },
    karachi: () => { CABLES.forEach(c => c.status !== 'retired' && c.edges.forEach(net.cutEdge)); note('<b>Karachi landing zone lost.</b> Only the China fibre, satellite and land borders remain', 'bad'); net.topologyChanged(cableEdges, 'BGP'); flyTo('overview'); },
    kkh: () => { const e = adj.get(N('Chilas').id).find(e => e.type === 'fiber' && (nodes[e.a].name === 'Gilgit' || nodes[e.b].name === 'Gilgit')); net.cutEdge(e); setLayer('microwave', true); note('Landslide cuts the KKH fibre — Gilgit-Baltistan fails over to the microwave chain', 'bad'); net.topologyChanged([e], 'OSPF'); flyTo('north'); },
    gwadar: () => { state.plannedActive = !state.plannedActive; setLayer('planned', state.plannedActive); note(state.plannedActive ? 'Gwadar landing and CPEC-II fibre switched on (what-if)' : 'Gwadar what-if off', state.plannedActive ? 'good' : ''); ui('scGwadar').classList.toggle('on', state.plannedActive); net.topologyChanged([]); },
    restore: restoreAll
  };

  return { cutCable, restoreAll, SCEN };
}

// Route tab: trace a route with Dijkstra / "Bellman-Ford" / "BGP" views.
// Bellman-Ford and BGP still reuse the Dijkstra path (see CLAUDE.md, mocked).
import { state } from '../state.js';
import { KM_PER_UNIT, lift } from '../geo/projection.js';
import { nodeSeq } from '../routing/paths.js';
import { propDelayMs } from '../sim/params.js';
import { ui, setTab } from './dom.js';
import { burst, highlightPath } from '../render/fx.js';

export const tierName = n => ({ core: 'Core router', agg: 'Aggregation router', access: 'City (access network)', cls: 'Cable landing station', ixp: 'Internet exchange', dc: 'Data centre / CDN', intl: 'International destination', sat: 'Satellite', gw: 'Satellite gateway', vsat: 'VSAT terminal', tower: 'Microwave relay' }[n.tier] || n.tier);
export const mediumName = e => ({ fiber: 'fibre', metro: 'metro fibre', subsea: 'submarine cable', access: 'last mile', mwaccess: 'microwave', microwave: 'microwave', mwbackup: 'microwave', aerial: 'aerial fibre', xborder: 'cross-border fibre', sat: 'satellite', planned: 'planned fibre' }[e.type] || e.type);

const ALGO_TXT = {
  dijkstra: 'Link-state (OSPF): every router knows the whole map and runs Dijkstra. Pulses show nodes settling in order of distance.',
  bf: 'Distance-vector (RIP): routers only share distances with neighbours, so estimates spread outward in waves.',
  bgp: 'Path-vector (BGP): networks choose routes by business policy. Hops are grouped by the operator (AS) carrying them.'
};

export function initRoute(ctx) {
  const { G, net, traffic, demos } = ctx;
  const { nodes, adj, N, INTL } = G;

  const routeNodes = nodes.filter(n => (n.kind === 'city' && n.tier !== 'access' && !/Pass/.test(n.name)) || (n.tier === 'intl' && !n.hideLabel) || (n.tier === 'cls' && !n.planned) || n.tier === 'dc' || n.tier === 'ixp')
    .sort((a, b) => (a.tier === 'intl') - (b.tier === 'intl') || a.name.localeCompare(b.name));

  function traceRoute() {
    const { algo, metric } = state;
    const s = +ui('rsrc').value, d = +ui('rdst').value; if (s === d) return;
    const res = net.shortest(s, d, { metric }); if (!res) { ui('rres').innerHTML = '<p class="muted">No path — destination unreachable.</p>'; return; }
    const p = highlightPath(s, res.edges);
    for (let i = 0; i < 5; i++) setTimeout(() => traffic.emitPacket(p, 'loop', { color: '#b45309', size: 0.12, speed: 1.8 }), i * 260);
    if (algo === 'dijkstra') res.order.filter(id => nodes[id].tier !== 'access').slice(0, 90).forEach((id, i) => setTimeout(() => burst(lift(nodes[id].pos, 0.02), '#d97706', 0.1, 0.6), i * 22));
    else if (algo === 'bf') {
      const seen = new Set([d]); let fr = [d];
      for (let k = 1; k < 9 && fr.length; k++) {
        const nf = []; for (const u of fr) for (const e of adj.get(u)) { if (!net.usable(e)) continue; const v = e.a === u ? e.b : e.a; if (!seen.has(v) && nodes[v].tier !== 'access') { seen.add(v); nf.push(v); } }
        fr = nf; nf.forEach(v => setTimeout(() => burst(lift(nodes[v].pos, 0.02), '#d97706', 0.12, 0.7), k * 380));
      }
    }
    const seq = nodeSeq(s, res.edges); let ms = 0; const rows = [];
    seq.forEach((id, i) => { const e = res.edges[i - 1]; if (e) ms += propDelayMs(e.len * KM_PER_UNIT) + 0.06; const n = nodes[id]; if (n.tier === 'tower') return; rows.push(`<li><span>${n.name}</span><em>${e ? mediumName(e) : 'start'}${algo === 'bgp' && e ? ' · ' + (e.cable ? e.cable.op : e.ops[0] || '—') : ''}</em><b>${(ms * 2).toFixed(1)}</b></li>`); });
    let asPath = '';
    if (algo === 'bgp') { const ap = []; res.edges.forEach(e => { const a = e.cable ? e.cable.op : e.ops[0]; if (a && ap[ap.length - 1] !== a) ap.push(a); }); asPath = `<div class="aspath">${ap.map(a => `<span>${a === 'PTCL' ? 'AS17557 PTCL' : a}</span>`).join('<i>›</i>')}</div>`; }
    ui('rres').innerHTML = `<div class="rsum"><div><b>${seq.length - 1}</b><small>hops</small></div><div><b>${(ms * 2).toFixed(1)}</b><small>ms round trip</small></div><div><b>${res.order.length}</b><small>nodes explored</small></div></div>${asPath}<details><summary>Hop by hop</summary><ol class="hops">${rows.join('')}</ol></details>`;
  }

  const opt = routeNodes.map(n => `<option value="${n.id}">${n.name}</option>`).join('');
  ui('rsrc').innerHTML = opt; ui('rdst').innerHTML = opt; ui('rsrc').value = N('Gilgit').id; ui('rdst').value = INTL.W.id;
  document.querySelectorAll('#algos button').forEach(b => b.onclick = () => {
    state.algo = b.dataset.a; document.querySelectorAll('#algos button').forEach(x => x.classList.toggle('on', x === b));
    ui('algoTxt').textContent = ALGO_TXT[state.algo]; ui('ctiWrap').style.display = state.algo === 'bf' ? '' : 'none';
  });
  ui('algoTxt').textContent = ALGO_TXT.dijkstra;
  ui('rmetric').onchange = e => state.metric = e.target.value;
  ui('btnTrace').onclick = traceRoute; ui('btnCTI').onclick = demos.countToInfinity;
  ui('btnSwap').onclick = () => { const a = ui('rsrc').value; ui('rsrc').value = ui('rdst').value; ui('rdst').value = a; };

  return { traceRoute, routeNodes, openRouteFrom: n => { if (routeNodes.includes(n)) ui('rsrc').value = n.id; setTab('route'); } };
}

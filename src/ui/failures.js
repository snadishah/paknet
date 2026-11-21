// Failures tab: scenario buttons, the cable list and the convergence toast.
import { state } from '../state.js';
import { on } from '../events.js';
import { ui, note } from './dom.js';

export function initFailures(ctx) {
  const { G, net, failures } = ctx;
  const { CABLES } = G;

  function renderCables() {
    ui('cablelist').innerHTML = CABLES.filter(c => c.status !== 'retired').map(c => {
      const cut = c.edges.every(e => e.cut), pending = c.status === 'landed' && !c.forceLive;
      const st = cut ? 'Cut' : c.forceLive ? 'Active (what-if)' : c.stat || (pending ? 'Landed, not in service' : 'Live');
      return `<label class="crow ${cut ? 'cut' : ''} ${pending ? 'pending' : ''}" title="${c.note || ''}"><div><b>${c.name}</b><small>${c.op} · ${st}</small></div><span class="tog"><input type="checkbox" data-c="${c.id}" ${!cut && !pending ? 'checked' : ''}><i></i></span></label>`;
    }).join('');
    ui('cablelist').querySelectorAll('input').forEach(i => i.onchange = () => {
      const c = CABLES.find(x => x.id === i.dataset.c);
      if (c.status === 'landed') {
        c.forceLive = i.checked;
        c.edges.forEach(e => { e.line.material.dashed = !c.forceLive; e.line.material.opacity = c.forceLive ? 0.75 : 0.5; if (i.checked && e.cut) net.restoreEdge(e); });
        note(`${c.name} ${c.forceLive ? 'activated (what-if)' : 'deactivated'}`); net.topologyChanged([]);
      } else failures.cutCable(c, !i.checked, ui('falgo').value);
    });
  }

  let convTimer = null;
  function showConv(algo, shown, T) {
    const el = ui('conv'); el.classList.add('on'); const s = performance.now();
    clearInterval(convTimer);
    convTimer = setInterval(() => {
      const f = Math.min(1, (performance.now() - s) / T);
      el.innerHTML = `<span>${f < 1 ? 'Rerouting' : 'Converged'} · ${algo}</span><b>${(shown * f).toFixed(shown < 5 ? 2 : 1)} s</b><i style="width:${f * 100}%"></i>`;
      if (f >= 1) { clearInterval(convTimer); setTimeout(() => el.classList.remove('on'), 2200); }
    }, 50);
  }

  on('topology:changed', ({ cutEdges, algo, T }) => { if (cutEdges.length) showConv(algo, state.lastConv, T); renderCables(); });
  document.querySelectorAll('[data-scen]').forEach(b => b.onclick = () => failures.SCEN[b.dataset.scen]());
  renderCables();
}

// Failures tab: scenario buttons, the cable list and the convergence toast.
import { state } from '../state.js';
import { on } from '../events.js';
import { ui, note } from './dom.js';
import { RIP_UPDATE_S } from '../sim/params.js';

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

  // RIP is simulated: show the live round count, then how many rounds it really took.
  let rip = null;
  function showRip(startRound) {
    clearInterval(convTimer); rip = { start: startRound };
    const el = ui('conv'); el.classList.add('on');
    el.innerHTML = `<span>Rerouting · RIP</span><b>round 0</b><i style="width:4%"></i>`;
  }
  on('dv:round', ({ round }) => {
    if (!rip) return; const n = round - rip.start;
    ui('conv').innerHTML = `<span>Rerouting · RIP</span><b>round ${n}</b><i style="width:${Math.min(96, n * 6)}%"></i>`;
  });
  on('rip:converged', ({ rounds }) => {
    if (!rip) return; rip = null;
    const el = ui('conv');
    el.innerHTML = `<span>Converged · RIP</span><b>${rounds} round${rounds === 1 ? '' : 's'} ≈ ${rounds * RIP_UPDATE_S} s</b><i style="width:100%"></i>`;
    setTimeout(() => { if (!rip) el.classList.remove('on'); }, 3500);
  });

  on('topology:changed', ({ cutEdges, algo, T }) => {
    if (cutEdges.length) { if (algo === 'RIP') showRip(net.dv.round); else showConv(algo, state.lastConv, T); }
    renderCables();
  });
  document.querySelectorAll('[data-scen]').forEach(b => b.onclick = () => failures.SCEN[b.dataset.scen]());
  // the protocol choice drives how traffic is forwarded (RIP) or the mocked timing (OSPF, BGP)
  ui('falgo').value = state.protocol;
  ui('falgo').onchange = e => setProtocol(e.target.value);
  renderCables();
}

export function setProtocol(p) {
  state.protocol = p;
  const sel = ui('falgo'); if (sel && sel.value !== p) sel.value = p;
}

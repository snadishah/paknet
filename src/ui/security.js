// Security tab (defence toggle, scenario buttons, the BGP beliefs table) and
// the Overview "Try it" buttons.
import { state } from '../state.js';
import { on } from '../events.js';
import { ui, setTab } from './dom.js';

export function initSecurity(ctx) {
  const { security, failures, route, interdomain } = ctx;
  ui('def').onchange = e => { state.defense = e.target.checked; ui('defTxt').textContent = state.defense ? 'Detects attacks and adapts routing automatically' : 'Off — watch what happens without it'; };
  ui('btnHijack').onclick = security.runHijack; ui('btnDDoS').onclick = security.runDDoS; ui('btnMal').onclick = security.runMalware;
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    const g = b.dataset.go;
    if (g === 'route') { setTab('route'); route.traceRoute(); }
    if (g === 'cut') { setTab('failures'); failures.SCEN.aae1(); }
    if (g === 'hijack') security.runHijack();
  });

  // What each network believes about YouTube's address, straight from BGP.
  const END = { youtube: ['ok', '→ YouTube'], ptcl: ['bad', '→ Pakistan · dropped'], lost: ['bad', 'no route'] };
  let dirty = false;
  function render() {
    dirty = false;
    const box = ui('bgpBox');
    if (!interdomain.active) { box.style.display = 'none'; return; }
    box.style.display = '';
    const order = { world: 0, transit: 1, pk: 2 };
    ui('bgpTable').innerHTML = interdomain.beliefs().sort((a, b) => order[a.kind] - order[b.kind]).map(r => {
      const [cls, txt] = END[r.end];
      const path = r.path.length > 1 ? r.path.slice(1).join(' › ') : r.path.length ? 'its own route' : '—';
      return `<div class="bgprow"><span>${r.name} <span class="muted">${r.asn < 64512 ? 'AS' + r.asn : ''}</span></span><em>${r.prefix || ''} via ${path}</em><b class="${cls}">${txt}</b></div>`;
    }).join('');
  }
  on('bgp:best', () => { if (!dirty) { dirty = true; setTimeout(render, 50); } });
  on('bgp:tick', ({ utc, fast }) => { ui('bgpClock').textContent = `${utc} UTC${fast ? ' ⏩' : ''}`; if (!dirty) { dirty = true; setTimeout(render, 50); } });
  on('bgp:action', render);
}

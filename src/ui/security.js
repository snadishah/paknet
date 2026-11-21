// Security tab (defence toggle, scenario buttons) and the Overview "Try it" buttons.
import { state } from '../state.js';
import { ui, setTab } from './dom.js';

export function initSecurity(ctx) {
  const { security, failures, route } = ctx;
  ui('def').onchange = e => { state.defense = e.target.checked; ui('defTxt').textContent = state.defense ? 'Detects attacks and adapts routing automatically' : 'Off — watch what happens without it'; };
  ui('btnHijack').onclick = security.runHijack; ui('btnDDoS').onclick = security.runDDoS; ui('btnMal').onclick = security.runMalware;
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    const g = b.dataset.go;
    if (g === 'route') { setTab('route'); route.traceRoute(); }
    if (g === 'cut') { setTab('failures'); failures.SCEN.aae1(); }
    if (g === 'hijack') security.runHijack();
  });
}

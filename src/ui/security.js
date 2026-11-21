// Security tab (defence toggle, scenario buttons, the BGP beliefs table) and
// the Overview "Try it" buttons.
import { state } from '../state.js';
import { on } from '../events.js';
import { ui, setTab } from './dom.js';

export function initSecurity(ctx) {
  const { security, failures, route, interdomain } = ctx;
  ui('def').onchange = e => { state.defense = e.target.checked; security.defence.enabled = state.defense; ui('defTxt').textContent = state.defense ? 'Detects attacks and adapts routing automatically' : 'Off — watch what happens without it'; };
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

  /* ---------- the MAPE-K strip ---------- */
  const strip = ph => document.querySelector(`#mapek [data-ph="${ph}"]`);
  const syncMonitor = () => strip('monitor').classList.toggle('on', state.defense);
  syncMonitor(); ui('def').addEventListener('change', syncMonitor);
  on('defence:phase', e => { const el = strip(e.phase); if (!el) return; el.classList.add('hot'); setTimeout(() => el.classList.remove('hot'), 2500); });

  /* ---------- before / after ---------- */
  const NAMES = { hijack: 'BGP hijack', ddos: 'DDoS on the Lahore CDN edge', mal: 'Compromised phones' };
  const fmt = ms => (ms == null ? '—' : ms < 1 ? (ms * 1000).toFixed(0) + ' µs' : ms.toFixed(1) + ' ms');
  on('defence:run', ({ name, runs }) => {
    const box = ui('compare');
    if (!(runs.off && runs.on)) {
      const have = runs.on ? 'on' : 'off';
      box.innerHTML = `<div class="cmp"><h6>${NAMES[name]}</h6><p class="muted" style="margin:0">Recorded a run with defence ${have}. Run it again with defence ${have === 'on' ? 'off' : 'on'} to compare.</p></div>`;
      return;
    }
    const rows = [
      ['Detected after', fmt(runs.off.detectMs), fmt(runs.on.detectMs)],
      ['Response after', fmt(runs.off.mitigateMs), fmt(runs.on.mitigateMs)],
      ['Peak loss', runs.off.peakLoss.toFixed(1) + ' %', runs.on.peakLoss.toFixed(1) + ' %'],
      ['Average loss', runs.off.meanLoss.toFixed(1) + ' %', runs.on.meanLoss.toFixed(1) + ' %']
    ];
    if (runs.off.extra || runs.on.extra) rows.push(['Outcome', runs.off.extra || '—', runs.on.extra || '—']);
    box.innerHTML = `<div class="cmp"><h6>${NAMES[name]}: before and after</h6><canvas id="cmpChart"></canvas>
      <table><tr><th></th><th><span class="k" style="background:#dc2626"></span>Defence off</th><th><span class="k" style="background:#2f6f53"></span>Defence on</th></tr>
      ${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table>
      <p class="muted" style="margin:6px 0 0">Loss of legitimate traffic over network time since the attack began. Times are network time (one on-screen second = 2 ms).</p></div>`;
    const cv = ui('cmpChart'), w = cv.width = cv.clientWidth * 2, h = cv.height = cv.clientHeight * 2, x = cv.getContext('2d');
    const all = [...runs.off.series, ...runs.on.series], tMax = Math.max(1e-6, ...all.map(p => p.t)), lMax = Math.max(2, ...all.map(p => p.loss)) * 1.1;
    for (const [run, col] of [[runs.off, '#dc2626'], [runs.on, '#2f6f53']]) {
      x.beginPath(); run.series.forEach((p, i) => { const px = p.t / tMax * w, py = h - p.loss / lMax * (h - 6) - 3; i ? x.lineTo(px, py) : x.moveTo(px, py); });
      x.lineWidth = 3; x.strokeStyle = col; x.stroke();
    }
  });
}

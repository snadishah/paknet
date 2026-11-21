// KPI bar, Overview traffic mix, Metrics tab, strip trends and router queue rings.
// Everything here is MEASURED from the discrete-event simulation (sim/traffic.js):
//   capacity    = lit capacity of the international links currently usable
//   throughput  = international traffic delivered per second of network time
//   RTT         = Karachi → Lahore → Karachi delay of tiny probe bundles (propagation + queueing)
//   loss        = bundles lost (tail drop, cut links, blackholes) ÷ bundles that finished
//   utilisation = share of time a link was transmitting
// Convergence time is still mocked until the real protocols land (step 5).
import { state } from '../state.js';
import { on } from '../events.js';
import { FLOW } from '../palette.js';
import { diurnal } from '../sim/traffic.js';
import { ui } from './dom.js';
import { layers } from '../render/scene.js';
import { drawHeat } from '../render/heat.js';

function spark(id, data, color, max) {
  const cv = ui(id); if (!cv || !cv.clientWidth) return; const w = cv.width = cv.clientWidth * 2, h = cv.height = cv.clientHeight * 2, x = cv.getContext('2d'); x.clearRect(0, 0, w, h);
  if (data.length < 2) return; const mx = max || Math.max(...data, 1e-6) * 1.2;
  x.beginPath(); data.forEach((v, i) => { const px = i / 119 * w, py = h - Math.min(1, v / mx) * (h - 6) - 3; i ? x.lineTo(px, py) : x.moveTo(px, py); });
  x.lineWidth = 3; x.strokeStyle = color; x.lineJoin = 'round'; x.stroke(); x.lineTo((data.length - 1) / 119 * w, h); x.lineTo(0, h); x.globalAlpha = 0.12; x.fillStyle = color; x.fill(); x.globalAlpha = 1;
}
const ewma = (prev, v, a = 0.35) => (prev == null ? v : prev + a * (v - prev));
const utilColour = u => (u > 0.85 ? '#dc2626' : u > 0.65 ? '#d97706' : '#0f766e');

export function initMetrics(ctx) {
  const { G, net, traffic, inspector } = ctx;
  const { CABLES, nodes } = G;
  const series = { thr: [], lat: [], loss: [], conv: [] };
  const smooth = { thr: null, loss: null };

  function updateCapacity() {
    const live = net.liveCables(), cap = traffic.intlCapacityTbps();
    ui('kCab').textContent = `${live.length}/${CABLES.filter(c => c.status !== 'retired').length}`; ui('kCap').textContent = cap.toFixed(1);
    return cap;
  }
  on('topology:changed', updateCapacity);

  setInterval(() => {
    const cap = updateCapacity();
    const m = traffic.sample(); if (!m) return; // paused: keep the last values on screen
    smooth.thr = ewma(smooth.thr, m.intlTbps); smooth.loss = ewma(smooth.loss, m.lossPct);
    const thr = smooth.thr, loss = smooth.loss, lat = m.rttMs;
    series.thr.push(thr); series.lat.push(lat ?? 0); series.loss.push(loss); series.conv.push(performance.now() < state.convergeUntil ? state.lastConv : 0);
    for (const k in series) if (series[k].length > 120) series[k].shift();

    ui('kThr').textContent = thr.toFixed(1); ui('kLat').textContent = lat != null ? lat.toFixed(0) : '—'; ui('kLoss').textContent = loss.toFixed(1);
    ui('kLossBox').classList.toggle('bad', loss > 1);
    ui('mThr').textContent = thr.toFixed(2) + ' Tbps'; ui('mLat').textContent = lat != null ? lat.toFixed(1) + ' ms' : '—'; ui('mLoss').textContent = loss.toFixed(2) + ' %';
    ui('mConv').textContent = series.conv.at(-1) ? series.conv.at(-1).toFixed(1) + ' s (mocked)' : 'stable';
    const thrMax = Math.max(cap, 1) * 1.1, lossMax = Math.max(2, ...series.loss) * 1.2;
    spark('cThr', series.thr, '#0f766e', thrMax); spark('cLat', series.lat, '#b45309'); spark('cLoss', series.loss, '#dc2626', lossMax); spark('cConv', series.conv, '#6d28d9');
    spark('sThr', series.thr, '#0f766e', thrMax); spark('sLat', series.lat, '#b45309'); spark('sLoss', series.loss, '#dc2626', lossMax);

    // cable utilisation: the busier direction of each cable
    ui('cutil').innerHTML = CABLES.filter(c => c.status !== 'retired').map(c => {
      const dead = c.edges.every(e => !net.usable(e));
      const u = dead ? 0 : Math.max(...c.edges.map(e => e.util || 0)) * 100;
      return `<div class="cu"><span>${c.name}</span><div class="bar"><i style="width:${u}%;background:${utilColour(u / 100)}"></i></div><em>${dead ? '—' : u.toFixed(0) + '%'}</em></div>`;
    }).join('');

    // traffic mix (delivered bundles, decaying)
    const ct = traffic.stats.cat, sum = ['intl', 'dom', 'cdn', 'sat'].reduce((a, k) => a + (ct[k] || 0), 0) || 1;
    ui('mix').innerHTML = ['intl', 'dom', 'cdn', 'sat'].filter(k => ct[k] > 0.5).map(k => `<div class="mx"><i style="background:${FLOW[k].c}"></i><span>${FLOW[k].label}</span><div class="bar"><b style="width:${(ct[k] / sum * 100).toFixed(1)}%;background:${FLOW[k].c}"></b></div><em>${(ct[k] / sum * 100).toFixed(0)}%</em></div>`).join('');
    for (const k in ct) ct[k] *= 0.6;

    // queue rings on core routers: fullest outgoing buffer
    for (const n of nodes) if (n.queue) {
      const f = Math.min(0.999, m.nodeQ.get(n.id) || 0); n.qf = f;
      n.queue.material.uniforms.uFill.value = Math.max(0.02, f); n.queue.material.uniforms.uCol.value.set(f > 0.85 ? '#dc2626' : f > 0.6 ? '#d97706' : '#16a34a');
    }
    if (layers.heat.visible) drawHeat(G, net);
    inspector.refresh(m, diurnal(state.simHour));
  }, 250);
}

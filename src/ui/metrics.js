// KPI bar, Overview traffic mix, Metrics tab charts and the router queue rings.
// THE NUMBERS ARE STILL MOCKED (formulas + noise); step 3 of docs/PLAN.md
// replaces them with values measured from the simulation.
import { state } from '../state.js';
import { on } from '../events.js';
import { FLOW } from '../palette.js';
import { diurnal } from '../sim/traffic.js';
import { INTL_CAPACITY_TBPS } from '../sim/params.js';
import { ui } from './dom.js';
import { layers } from '../render/scene.js';
import { drawHeat } from '../render/heat.js';

function spark(id, data, color, max) {
  const cv = ui(id); if (!cv || !cv.clientWidth) return; const w = cv.width = cv.clientWidth * 2, h = cv.height = cv.clientHeight * 2, x = cv.getContext('2d'); x.clearRect(0, 0, w, h);
  if (data.length < 2) return; const mx = max || Math.max(...data, 1e-6) * 1.2;
  x.beginPath(); data.forEach((v, i) => { const px = i / 119 * w, py = h - v / mx * (h - 6) - 3; i ? x.lineTo(px, py) : x.moveTo(px, py); });
  x.lineWidth = 3; x.strokeStyle = color; x.lineJoin = 'round'; x.stroke(); x.lineTo((data.length - 1) / 119 * w, h); x.lineTo(0, h); x.globalAlpha = 0.12; x.fillStyle = color; x.fill(); x.globalAlpha = 1;
}

export function initMetrics(ctx) {
  const { G, net, traffic, inspector } = ctx;
  const { CABLES, nodes, adj, edges } = G;
  const { stats } = traffic;
  const scen = state.scen;
  const series = { thr: [], lat: [], loss: [], conv: [] };
  // Capacity scales with the share of cables still live; peak demand keeps the
  // proof-of-concept's demand/capacity ratio (12.4 / 16.5) on the new figure.
  const BASE_SHARE = CABLES.filter(c => c.status === 'live').reduce((a, c) => a + c.share, 0);
  const PEAK_DEMAND = INTL_CAPACITY_TBPS * 12.4 / 16.5;

  function updateKPIs() {
    const live = net.liveCables(); const cap = Math.max(0.35, live.reduce((a, c) => a + c.share, 0) * INTL_CAPACITY_TBPS / BASE_SHARE + (state.plannedActive ? 2 : 0));
    ui('kCab').textContent = `${live.length}/${CABLES.filter(c => c.status !== 'retired').length}`; ui('kCap').textContent = cap.toFixed(1); return cap;
  }
  on('topology:changed', updateKPIs);

  setInterval(() => {
    const cap = updateKPIs(), load = diurnal(state.simHour), demand = PEAK_DEMAND * load + (scen.ddos ? 3 : 0);
    const thr = Math.min(cap * 0.97, demand) * (0.97 + Math.random() * 0.06);
    const congestion = Math.min(4, Math.max(0, demand / Math.max(cap, 0.1) - 0.8));
    const loss = Math.min(100, (stats.sent ? stats.dropped / stats.sent * 100 : 0) + congestion * 8);
    const lat = 21 + congestion * 90 + (scen.ddos && scen.ddos.phase === 1 ? 120 : 0) + Math.random() * 2;
    series.thr.push(thr); series.lat.push(lat); series.loss.push(loss); series.conv.push(performance.now() < state.convergeUntil ? state.lastConv : 0);
    for (const k in series) if (series[k].length > 120) series[k].shift();
    ui('kThr').textContent = thr.toFixed(1); ui('kLat').textContent = lat.toFixed(0); ui('kLoss').textContent = loss.toFixed(1);
    ui('kLoss').parentElement.classList.toggle('bad', loss > 1);
    ui('mThr').textContent = thr.toFixed(1) + ' Tbps'; ui('mLat').textContent = lat.toFixed(0) + ' ms'; ui('mLoss').textContent = loss.toFixed(2) + ' %'; ui('mConv').textContent = series.conv.at(-1) ? series.conv.at(-1).toFixed(1) + ' s' : 'stable';
    spark('cThr', series.thr, '#0f766e', INTL_CAPACITY_TBPS * 1.1); spark('cLat', series.lat, '#b45309'); spark('cLoss', series.loss, '#dc2626'); spark('cConv', series.conv, '#6d28d9');
    const tot = Object.values(stats.cableLoad).reduce((a, b) => a + b, 0) || 1;
    ui('cutil').innerHTML = CABLES.filter(c => c.status !== 'retired').map(c => { const dead = c.edges.every(e => e.cut) || (c.status === 'landed' && !c.forceLive); const u = dead ? 0 : Math.min(98, (stats.cableLoad[c.id] || 0) / tot * 100 / Math.max(0.03, c.share) * 0.42 * load + 8); return `<div class="cu"><span>${c.name}</span><div class="bar"><i style="width:${u}%;background:${u > 85 ? '#dc2626' : u > 65 ? '#d97706' : '#0f766e'}"></i></div><em>${dead ? '—' : u.toFixed(0) + '%'}</em></div>`; }).join('');
    stats.cableLoad = {}; stats.sent = 0; stats.dropped = 0;
    const ct = stats.cat, sum = ['intl', 'dom', 'cdn', 'sat'].reduce((a, k) => a + (ct[k] || 0), 0) || 1;
    ui('mix').innerHTML = ['intl', 'dom', 'cdn', 'sat'].filter(k => ct[k] > 0.5).map(k => `<div class="mx"><i style="background:${FLOW[k].c}"></i><span>${FLOW[k].label}</span><div class="bar"><b style="width:${(ct[k] / sum * 100).toFixed(1)}%;background:${FLOW[k].c}"></b></div><em>${(ct[k] / sum * 100).toFixed(0)}%</em></div>`).join('');
    for (const k in ct) ct[k] *= 0.6;
    for (const n of nodes) if (n.queue) { let l = 0; for (const e of adj.get(n.id)) l += e.load; const f = Math.min(0.999, 0.08 + l / 700 + (scen.ddos && scen.ddos.phase === 1 && n === scen.ddos.target.city ? 0.9 : 0)); n.qf = f; n.queue.material.uniforms.uFill.value = f; n.queue.material.uniforms.uCol.value.set(f > 0.85 ? '#dc2626' : f > 0.6 ? '#d97706' : '#16a34a'); }
    if (layers.heat.visible) drawHeat(G, net);
    for (const e of edges) e.load *= 0.5;
    inspector.refresh(load);
  }, 250);
}

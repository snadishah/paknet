// Panel chrome: tabs, dock pop-ups (Layers, Views, Legend) and the playback pill.
import { state } from '../state.js';
import { on } from '../events.js';
import { FLOW } from '../palette.js';
import { ui, setTab, closePanel, panelOpen, activeTab } from './dom.js';
import { layers, labelRenderer } from '../render/scene.js';
import { flyTo, setTour, tourOn } from '../render/camera.js';
import { showLayer, fadeOpacity } from '../render/fade3d.js';

const LAYER_UI = [
  ['Network', [['backbone', 'Fibre backbone'], ['cables', 'Submarine cables'], ['gateways', 'Landing stations, IXPs, data centres'], ['microwave', 'Microwave backup (KKH)'], ['satellite', 'Satellite (PakSat-MM1)'], ['planned', 'Planned (Gwadar, CPEC-II)']]],
  ['Places', [['cities', 'All cities'], ['lastmile', 'Last-mile links'], ['labels', 'Labels']]],
  ['Traffic', [['packets', 'Packets'], ['heat', 'Link load']]]
];

const LEGEND_SHAPES = `<hr><div class="lg"><svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="#22312b"/><circle cx="8" cy="8" r="4" fill="#fff"/></svg>Core router</div><div class="lg"><svg width="16" height="16"><circle cx="8" cy="8" r="3" fill="#22312b"/></svg>Aggregation router</div><div class="lg"><svg width="16" height="16"><circle cx="8" cy="8" r="2" fill="#22312b" opacity=".5"/></svg>City</div><div class="lg"><svg width="16" height="16"><rect x="4" y="4" width="8" height="8" fill="#c2410c"/></svg>Cable landing station</div><div class="lg"><svg width="16" height="16"><path d="M8 2l6 6-6 6-6-6z" fill="#ca8a04"/></svg>Internet exchange (PKIX)</div><div class="lg"><svg width="16" height="16"><rect x="5" y="3" width="6" height="10" fill="#6d28d9"/></svg>Data centre / CDN</div><div class="lg"><svg width="16" height="16"><line x1="1" y1="8" x2="15" y2="8" stroke="#22312b" stroke-width="2.5"/></svg>Fibre (trunk / regional)</div><div class="lg"><svg width="16" height="16"><line x1="1" y1="8" x2="15" y2="8" stroke="#2f4858" stroke-width="1.5"/></svg>Submarine cable</div><div class="lg"><svg width="16" height="16"><line x1="1" y1="8" x2="15" y2="8" stroke="#22312b" stroke-width="1.5" stroke-dasharray="3 2"/></svg>Dashed: microwave, cross-border or not yet active</div>`;

// Returns setLayer(k, visible), used by scenarios too.
export function initPanel(ctx) {
  const { G, traffic } = ctx;

  // rail tabs: clicking the open tab again closes the panel
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => (panelOpen() && activeTab() === b.dataset.tab ? closePanel() : setTab(b.dataset.tab)));
  ui('panelClose').onclick = closePanel; ui('sheetHandle').onclick = closePanel;
  ui('btnHide').onclick = () => (panelOpen() ? closePanel() : setTab(activeTab()));
  ui('btnStories').onclick = () => { setTab('overview'); ui('pane-overview').querySelector('h5')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
  // panel starts open on desktop, closed on phones
  if (matchMedia('(min-width: 721px)').matches) setTab('overview'); else closePanel();

  // layers
  ui('layerList').innerHTML = LAYER_UI.map(([g, items]) => `<h3 class="h5">${g}</h3>` + items.map(([k, t]) => `<label class="chk"><input type="checkbox" data-k="${k}" ${layers[k].visible ? 'checked' : ''}><i></i>${t}</label>`).join('')).join('');
  function setLayer(k, v) {
    showLayer(layers[k], v); const i = document.querySelector(`[data-k="${k}"]`); if (i) i.checked = v; // 400 ms fade
    if (k === 'labels') labelRenderer.domElement.style.display = v ? '' : 'none';
    if (k === 'satellite') traffic.flags.satellite = v;
    if (k === 'heat') { layers.backbone.children.forEach(c => fadeOpacity(c.material, v ? 0.25 : c.userData.o ?? c.material.opacity)); G.nodes.forEach(n => n.queue && (n.queue.visible = v)); }
  }
  traffic.flags.satellite = layers.satellite.visible;
  document.querySelectorAll('#layerList input').forEach(i => i.onchange = () => setLayer(i.dataset.k, i.checked));

  // pop-ups
  const closePops = () => { document.querySelectorAll('.pop').forEach(x => x.classList.remove('on')); document.querySelectorAll('[data-pop]').forEach(x => x.classList.remove('on')); };
  document.querySelectorAll('[data-pop]').forEach(b => b.onclick = (ev) => {
    ev.stopPropagation(); const p = ui(b.dataset.pop); const open = !p.classList.contains('on'); closePops();
    if (!open) return;
    p.classList.add('on'); b.classList.add('on');
    // desktop: line the pop-up up with the rail button that opened it
    if (b.closest('#rail')) { const r = b.getBoundingClientRect(); p.style.top = Math.max(16, Math.min(r.top, innerHeight - p.offsetHeight - 88)) + 'px'; }
    else p.style.top = '';
  });
  document.addEventListener('click', ev => { if (!ev.target.closest('.pop')) closePops(); });

  // legend
  ui('legendList').innerHTML = ['intl', 'dom', 'cdn', 'sat', 'atk'].map(k => `<div class="lg"><i style="background:${FLOW[k].c}"></i>${FLOW[k].label}</div>`).join('') + LEGEND_SHAPES;

  // views + tour
  on('view:changed', k => document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === k)));
  document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { setTour(false); ui('btnTour').classList.remove('on'); flyTo(b.dataset.view); });
  ui('btnTour').onclick = () => { setTour(!tourOn()); ui('btnTour').classList.toggle('on', tourOn()); };

  // playback
  ui('play').onclick = () => { state.playing = !state.playing; ui('play').classList.toggle('paused', !state.playing); };
  document.querySelectorAll('#speeds button').forEach(b => b.onclick = () => { state.speed = +b.dataset.s; document.querySelectorAll('#speeds button').forEach(x => x.classList.toggle('on', x === b)); });
  ui('tod').oninput = e => state.simHour = +e.target.value;

  return setLayer;
}

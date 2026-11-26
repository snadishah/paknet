// Hover tooltip and the node inspector card.
import { ui, note } from './dom.js';
import { tierName, mediumName } from './route.js';
import { renderer } from '../render/scene.js';

export function initInspector(ctx) {
  const { G, net, view, route, traffic } = ctx;
  const { nodes, adj, edges } = G;
  let hoverNode = null, inspectNode = null, hoverPending = null, downAt = null;

  renderer.domElement.addEventListener('pointermove', ev => { if (!ev.buttons) hoverPending = [ev.clientX, ev.clientY]; });
  renderer.domElement.addEventListener('pointerdown', ev => downAt = [ev.clientX, ev.clientY]);
  renderer.domElement.addEventListener('pointerup', ev => { if (downAt && Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) < 5) { if (!document.body.classList.contains('expert')) return; hoverNode ? open(hoverNode) : close(); } });

  // screen-space pick of the nearest marker (render/network.js)
  const pick = ([x, y]) => view.pick(x, y);

  function tip(n, x, y) {
    const t = ui('tip'); if (!n) { t.style.opacity = 0; return; }
    t.innerHTML = `<b>${n.name}</b><small>${tierName(n)}${n.pop ? ' · pop. ' + n.pop.toLocaleString() : ''}</small>${n.note ? `<small class="nt">${n.note}</small>` : ''}`; t.style.opacity = 1; t.style.transform = `translate(${x + 14}px, ${y + 12}px)`;
  }

  function open(n) {
    inspectNode = n; const el = ui('insp'); el.classList.add('on');
    const links = adj.get(n.id).filter(e => e.type !== 'access' || n.tier === 'access').slice(0, 7).map(e => { const o = nodes[e.a === n.id ? e.b : e.a]; return `<li class="${e.cut ? 'cut' : ''}"><span>${o.name}</span><em>${mediumName(e)}</em><b data-e="${e.id}"></b></li>`; }).join('');
    el.innerHTML = `<button class="x" id="inspX" aria-label="Close">×</button><small class="kick">${tierName(n)}</small><h3>${n.name}</h3>${n.note ? `<p class="muted nt">${n.note}</p>` : ''}
    <div class="meters"><div><label>Queue</label><div class="bar"><i id="iq"></i></div></div><div><label>Load</label><b id="ipps">—</b></div></div>
    <label class="sub">Links</label><ul class="links">${links || '<li class="muted">none</li>'}</ul>
    <div class="row"><button class="btn sm" id="iSrc">Route from here</button><button class="btn sm ghost danger" id="iFail">Fail this node</button></div>`;
    ui('inspX').onclick = close;
    ui('iSrc').onclick = () => route.openRouteFrom(n);
    ui('iFail').onclick = () => { const es = adj.get(n.id).filter(e => !e.cut); es.forEach(net.cutEdge); note(`${n.name} failed — ${es.length} links down`, 'bad'); net.topologyChanged(es, 'OSPF'); open(n); };
  }
  function close() { inspectNode = null; ui('insp').classList.remove('on'); }

  // Called every frame: resolve the pending hover pick.
  function frame() {
    if (!hoverPending) return;
    const n = pick(hoverPending); hoverNode = n; tip(n, ...hoverPending); renderer.domElement.style.cursor = n ? 'pointer' : ''; hoverPending = null;
  }

  // Called on each metrics tick with the measured sample: queue = fullest
  // outgoing buffer, load = traffic leaving this node, links = utilisation.
  function refresh(m) {
    if (!inspectNode || !ui('iq')) return;
    const q = m.nodeQ.get(inspectNode.id) || 0;
    let gbps = 0;
    for (const L of traffic.engine.links.values()) if ((L.dir === 0 ? L.e.a : L.e.b) === inspectNode.id) gbps += (L.e.util || 0) * L.cap;
    ui('iq').style.width = (q * 100).toFixed(0) + '%';
    ui('ipps').textContent = gbps >= 1000 ? (gbps / 1000).toFixed(2) + ' Tbps' : gbps.toFixed(1) + ' Gbps';
    document.querySelectorAll('#insp [data-e]').forEach(b => { const e = edges[+b.dataset.e]; b.textContent = !net.usable(e) ? 'down' : ((e.util || 0) * 100).toFixed(0) + '%'; });
  }

  return { frame, refresh, open, close };
}

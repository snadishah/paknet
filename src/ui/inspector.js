// Hover tooltip and the node inspector card.
import * as THREE from 'three';
import { ui, note } from './dom.js';
import { tierName, mediumName } from './route.js';
import { camera, renderer } from '../render/scene.js';

export function initInspector(ctx) {
  const { G, net, view, route } = ctx;
  const { nodes, adj, edges, accessNodes } = G;
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let hoverNode = null, inspectNode = null, hoverPending = null, downAt = null;

  renderer.domElement.addEventListener('pointermove', ev => { mouse.set(ev.clientX / innerWidth * 2 - 1, -ev.clientY / innerHeight * 2 + 1); hoverPending = [ev.clientX, ev.clientY]; });
  renderer.domElement.addEventListener('pointerdown', ev => downAt = [ev.clientX, ev.clientY]);
  renderer.domElement.addEventListener('pointerup', ev => { if (downAt && Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) < 5) hoverNode ? open(hoverNode) : close(); });

  function pick() {
    ray.setFromCamera(mouse, camera);
    const vis = view.pickables.filter(o => { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; });
    const hit = ray.intersectObjects(vis, true)[0]; if (!hit) return null;
    return hit.object === view.accMesh ? accessNodes[hit.instanceId] : hit.object.userData.node || null;
  }

  function tip(n, x, y) {
    const t = ui('tip'); if (!n) { t.style.opacity = 0; return; }
    t.innerHTML = `<b>${n.name}</b><small>${tierName(n)}${n.pop ? ' · pop. ' + n.pop.toLocaleString() : ''}</small>`; t.style.opacity = 1; t.style.transform = `translate(${x + 14}px, ${y + 12}px)`;
  }

  function open(n) {
    inspectNode = n; const el = ui('insp'); el.classList.add('on');
    const links = adj.get(n.id).filter(e => e.type !== 'access' || n.tier === 'access').slice(0, 7).map(e => { const o = nodes[e.a === n.id ? e.b : e.a]; return `<li class="${e.cut ? 'cut' : ''}"><span>${o.name}</span><em>${mediumName(e)}</em><b data-e="${e.id}"></b></li>`; }).join('');
    el.innerHTML = `<button class="x" id="inspX" aria-label="Close">×</button><small class="kick">${tierName(n)}</small><h3>${n.name}</h3>
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
    const n = pick(); hoverNode = n; tip(n, ...hoverPending); renderer.domElement.style.cursor = n ? 'pointer' : ''; hoverPending = null;
  }

  // Called on each metrics tick with the current diurnal load.
  function refresh(load) {
    if (!inspectNode || !ui('iq')) return;
    let l = 0; adj.get(inspectNode.id).forEach(e => l += e.load);
    ui('iq').style.width = ((inspectNode.qf ?? Math.min(0.9, 0.05 + l / 200)) * 100) + '%';
    ui('ipps').textContent = Math.round(l * 2400 * load).toLocaleString() + ' pkt/s';
    document.querySelectorAll('#insp [data-e]').forEach(b => { const e = edges[+b.dataset.e]; b.textContent = e.cut ? 'down' : Math.min(99, 4 + e.load * 3).toFixed(0) + '%'; });
  }

  return { frame, refresh, open, close };
}

// What stories can do to the world. Each story beat calls these; nothing here
// fakes an outcome: cutting a cable, announcing a route or starting an attack
// goes through the same simulation as the rest of the app.
import { state } from '../state.js';
import { on } from '../events.js';
import { CABLE_GBPS, BUFFER_MS } from '../sim/params.js';
import { edgeCapacityGbps } from '../sim/links.js';
import { ui } from '../ui/dom.js';

export function createKit(ctx) {
  const { G, net, traffic, interdomain, security } = ctx;
  const cable = id => G.CABLES.find(c => c.id === id);
  let lastSample = null; on('metrics:sample', m => (lastSample = m));

  /* ---------- world state ---------- */
  const capOriginal = new Map();
  function setCableCapacity(id, gbps) {
    if (!capOriginal.has(id)) capOriginal.set(id, CABLE_GBPS[id]);
    CABLE_GBPS[id] = gbps; refreshCable(id); net.topologyChanged([]);
  }
  function refreshCable(id) {
    for (const L of traffic.engine.links.values()) if (L.e.cable?.id === id) { L.cap = edgeCapacityGbps(G, L.e); L.bufGbit = L.cap * BUFFER_MS / 1000; }
  }
  // Back to the normal network: no scenario, no cuts, no what-ifs, original capacities.
  function reset() {
    security.stop(); state.scen.fb = null; interdomain.stop();
    for (const [id, g] of capOriginal) { CABLE_GBPS[id] = g; refreshCable(id); } capOriginal.clear();
    G.edges.forEach(e => net.restoreEdge(e));
    for (const c of G.CABLES) if (c.forceLive) c.forceLive = false;
    state.plannedActive = false; net.resetConvergence(); net.topologyChanged([]);
  }
  function cut(ids) { const es = ids.flatMap(id => cable(id).edges); es.forEach(net.cutEdge); net.topologyChanged(es, 'BGP'); }
  function restore(ids) { ids.flatMap(id => cable(id).edges).forEach(net.restoreEdge); net.topologyChanged([]); }
  function setDefence(v) { state.defense = v; security.defence.enabled = v; const t = ui('def'); if (t) { t.checked = v; t.dispatchEvent(new Event('change')); } }

  /* ---------- inter-domain ---------- */
  function hijackWorld() { interdomain.startManual({ start: '18:47:45' }); state.scen.hijack = { story: true, lastReport: '' }; }
  function fbWorld() { interdomain.startManual({ start: '15:39:00' }); state.scen.fb = {}; }
  // At `offset` ms after the story's start time, perform a named BGP action.
  // fast: deliver every update at once (used when replaying earlier beats).
  function bgp(offset, action, fast) { interdomain.jumpTo(offset); if (action) interdomain.act(action); if (fast) interdomain.settle(); }

  /* ---------- camera ---------- */
  // A camera pose looking at a place from the south, `zoom` 1 = regional.
  function focus(name, zoom = 1) {
    const n = G.N(name) || G.nodes.find(x => x.name === name); const t = n.pos;
    return { p: [t.x + 0.6 * zoom, t.y - 3.6 * zoom, 3.4 * zoom], t: [t.x + 0.6 * zoom, t.y, 0] };
  }

  /* ---------- reading the world ---------- */
  const util = id => Math.max(0, ...cable(id).edges.map(e => e.util || 0));
  const metrics = () => ({ ...(lastSample || {}), capTbps: traffic.intlCapacityTbps(), cablesLive: net.liveCables().length });
  const lastDefence = phase => [...security.defence.log].reverse().find(e => e.phase === phase);

  return { G, net, traffic, interdomain, security, cable, reset, cut, restore, setCableCapacity, setDefence, hijackWorld, fbWorld, bgp, focus, util, metrics, lastDefence };
}

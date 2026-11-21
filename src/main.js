// PAKNET entry point: builds the modules, wires events and runs the main loop.
// Module map:
//   geo/        projection, province outlines
//   graph/      topology builder (nodes, edges, cables)
//   routing/    Dijkstra, path geometry                 (no three.js rendering, no DOM)
//   sim/        network state, traffic generator         (no three.js rendering, no DOM)
//   render/     scene, basemap, network, labels, packets, fx, heat, camera
//   ui/         panel, route, failures, security, metrics, inspector
//   scenarios/  failure, security and routing demos (orchestrate sim + render + ui)
import * as THREE from 'three';
import { state } from './state.js';
import { on } from './events.js';
import { lift } from './geo/projection.js';
import { buildTopology } from './graph/topology.js';
import { createNetwork } from './sim/network.js';
import { createTraffic } from './sim/traffic.js';
import { DV_ROUND_S } from './sim/params.js';
import { renderer, labelRenderer, scene, camera, controls, layers } from './render/scene.js';
import { buildBasemap } from './render/basemap.js';
import { drawNetwork } from './render/network.js';
import { buildLabels, updateLabels } from './render/labels.js';
import { initPackets, drawPackets, packetPos } from './render/packets.js';
import { burst, markCut, unmarkCut, clearHighlight, hasHighlight, updateFx, setMarkScale } from './render/fx.js';
import { flyTo, updateCamera } from './render/camera.js';
import { ui, setTab } from './ui/dom.js';
import { initPanel } from './ui/panel.js';
import { initRoute } from './ui/route.js';
import { initFailures } from './ui/failures.js';
import { initSecurity } from './ui/security.js';
import { initInspector } from './ui/inspector.js';
import { initMetrics } from './ui/metrics.js';
import { createFailures } from './scenarios/failures.js';
import { createSecurity } from './scenarios/security.js';
import { createRoutingDemos } from './scenarios/routing-demos.js';

/* ---------- build ---------- */
buildBasemap();
const G = buildTopology();
const view = drawNetwork(G);
buildLabels(G);
initPackets();
const net = createNetwork(G);
const traffic = createTraffic(G, net);

/* ---------- simulation → rendering ---------- */
on('edge:cut', e => { markCut(e); burst(lift(e.cutPos, 0.06), '#dc2626', 0.5, 1); traffic.onCut(e); });
on('edge:restore', unmarkCut);
on('topology:changed', ({ cutEdges }) => { if (hasHighlight() && cutEdges.length) clearHighlight(); });
// OSPF flooding wave: a ring at each router the moment a new LSA reaches it
on('ospf:lsa', ({ router }) => { if (state.protocol === 'OSPF' && G.nodes[router].tier !== 'intl') burst(lift(G.nodes[router].pos, 0.02), '#0f766e', 0.14, 0.7); });

/* ---------- scenarios + UI ---------- */
const ctx = { G, net, traffic, view, flyTo };
ctx.setLayer = initPanel(ctx);
ctx.failures = createFailures(ctx);
ctx.security = createSecurity(ctx);
ctx.demos = createRoutingDemos(ctx);
ctx.route = initRoute(ctx);
initFailures(ctx);
initSecurity(ctx);
ctx.inspector = initInspector(ctx);
initMetrics(ctx);

const { SCEN } = ctx.failures, { runHijack, runDDoS, runMalware } = ctx.security;
window.__flyTo = flyTo;
window.__sim = { SCEN, runHijack, runDDoS, runMalware, setTab, traceRoute: ctx.route.traceRoute, countToInfinity: ctx.demos.countToInfinity, setLayer: ctx.setLayer, inspect: name => ctx.inspector.open(G.N(name)),
  // debug: advance the simulation by `seconds` of wall time without waiting for frames
  tick: (seconds = 1) => { for (let t = 0; t < seconds; t += 1 / 60) stepWorld(state.speed / 60); },
  traffic, net };

/* ---------- main loop ---------- */
const fmtClock = h => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
const clock = new THREE.Clock();
let lastNF = -1;

// Bursts where bundles are lost (tail drop, cut link, blocked) or swallowed by a sink.
const packetEvents = {
  drop: b => { if (Math.random() < 0.3) burst(packetPos(b, b.d), '#dc2626', 0.1, 0.5); },
  arrive: b => { if (b.opt.sink && Math.random() < 0.2) burst(packetPos(b, b.d), '#dc2626', 0.22, 0.6); }
};

// Advance everything that runs on simulated time by sdt (wall seconds × speed):
// attack traffic, RIP rounds and OSPF events (each on its own compressed clock) and the packet engine.
let dvClock = 0;
function stepWorld(sdt) {
  if (sdt > 0) {
    ctx.security.spawn(sdt);
    dvClock += sdt; while (dvClock >= DV_ROUND_S) { dvClock -= DV_ROUND_S; net.dvRound(); }
    net.lsAdvance(sdt);
  }
  traffic.advance(sdt, packetEvents);
}

function frame() {
  const dt = Math.min(0.05, clock.getDelta()); const sdt = state.playing ? dt * state.speed : 0;
  updateCamera();
  if (state.playing) { state.simHour = (state.simHour + sdt / 30) % 24; ui('tod').value = state.simHour; ui('kClock').textContent = fmtClock(state.simHour); }
  stepWorld(sdt);
  drawPackets(traffic.packets);
  updateFx(dt);
  layers.gateways.children.forEach(m => { if (m.userData.spin) m.userData.spin.rotation.z += dt; });
  const dist = camera.position.distanceTo(controls.target);
  const nf = Math.min(1.3, Math.max(0.28, dist / 14));
  if (Math.abs(nf - lastNF) > 0.01) { lastNF = nf; for (const n of G.nodes) if (n.mesh && n.tier !== 'sat') n.mesh.scale.setScalar(nf); view.setAccScale(Math.max(0.4, nf)); setMarkScale(nf); }
  updateLabels(dist);
  ctx.inspector.frame();
  renderer.render(scene, camera); labelRenderer.render(scene, camera);
  requestAnimationFrame(frame);
}

flyTo('overview', 3200);
requestAnimationFrame(frame);

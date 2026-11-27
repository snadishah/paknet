// PAKNET entry point: builds the modules, wires events and runs the main loop.
// Module map:
//   geo/        flat map projection, globe maths (globe.js), province outlines
//   graph/      topology builder (nodes, edges, cables) in the flat map plane
//   routing/    RIP, OSPF, BGP, Dijkstra, path geometry   (no three.js rendering, no DOM)
//   sim/        network state, packet engine, traffic     (no three.js rendering, no DOM)
//   defence/    MAPE-K detectors and loop                 (no three.js rendering, no DOM)
//   render/     scene, globe, camera, tiles, network, labels, packets, fx, heat
//   ui/         shell (layman UI) + the Expert panels
//   scenarios/  failure, security and routing demos (orchestrate sim + render + ui)
import { state } from './state.js';
import { on } from './events.js';
import { lift } from './geo/projection.js';
import { buildTopology } from './graph/topology.js';
import { createNetwork } from './sim/network.js';
import { createTraffic } from './sim/traffic.js';
import { createInterdomain } from './sim/interdomain.js';
import { addOffices, createOffices } from './sim/offices.js';
import { updateCity, cityState } from './render/city.js';
import { initTraceroute } from './ui/traceroute.js';
import { initGlossary } from './ui/glossary.js';
import { initTour } from './ui/tour.js';
import { initScenarios } from './ui/scenarios.js';
import { DV_ROUND_S } from './sim/params.js';
import { renderer, labelRenderer, scene, camera, setLift } from './render/scene.js';
import { buildGlobe, updateGlobe } from './render/globe.js';
import * as THREE from 'three';
import { initTiles, updateTiles, tileDebug, tileState } from './render/tiles.js';
import { initSatellites, updateSatellites } from './render/satellites.js';
import { drawNetwork, glyphUniforms } from './render/network.js';
import { buildLabels, updateLabels, hasCallouts } from './render/labels.js';
import { initPackets, drawPackets, packetPos, packetUniforms, setTrailStep } from './render/packets.js';
import { sendOnward, updateOnward } from './render/onward.js';
import { edgeDelayMs } from './sim/links.js';
import { burst, markCut, unmarkCut, clearHighlight, hasHighlight, updateFx } from './render/fx.js';
import { flyTo, updateCamera, altitudeKm, pose, setPose, spin } from './render/globecam.js';
import { updateTour } from './render/camera.js';
import { watchFrame, qualityState } from './render/quality.js';
import { layers } from './render/scene.js';
import { ui, setTab, note } from './ui/dom.js';
import { initPanel } from './ui/panel.js';
import { initRoute } from './ui/route.js';
import { initFailures } from './ui/failures.js';
import { initSecurity } from './ui/security.js';
import { initInspector } from './ui/inspector.js';
import { initMetrics } from './ui/metrics.js';
import { initStories } from './ui/story.js';
import { initSources } from './ui/sources.js';
import { initShell, clock as shellClock } from './ui/shell.js';
import { initSatelliteUI } from './ui/satui.js';
import { createFailures } from './scenarios/failures.js';
import { createSecurity } from './scenarios/security.js';
import { createRoutingDemos } from './scenarios/routing-demos.js';
import { updateFades } from './render/fade3d.js';
import { initLandmarks, updateLandmarks, landmarkState } from './render/landmarks.js';
import { updatePaksat3d, PAKSAT_VIEW, paksatShown as paksatShownNow } from './render/paksat3d.js';
import { initWatch } from './ui/watch.js';

/* ---------- build ---------- */
const T0 = performance.now(); window.__paknetTiming = {};
const globeReady = buildGlobe();
initTiles();
const G = buildTopology();
addOffices(G); // five illustrative office hosts (leaf nodes: routes between cities don't change)
// the road file loads in parallel with the textures; without it the corridors stay straight
const ROADS = await fetch('assets/roads.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
const view = drawNetwork(G, ROADS);
buildLabels(G);
initPackets(G);
const net = createNetwork(G);
const traffic = createTraffic(G, net);
const offices = createOffices(G, net, traffic);
// 3D models at the network's sites; an office's rack lights follow how many of its parcels are on the way
initLandmarks(G, offices.OFFICES);
landmarkState.activity = key => Math.min(1, offices.getFlowsFrom(key).length / 10);

/* ---------- simulation → rendering ---------- */
on('edge:cut', e => { markCut(e); burst(e.cutPos, '#e5484d', 0.5, 1); traffic.onCut(e); });
on('edge:restore', unmarkCut);
on('topology:changed', ({ cutEdges }) => { if (hasHighlight() && cutEdges.length) clearHighlight(); });
// OSPF flooding wave: a ring at each router the moment a new LSA reaches it
on('ospf:lsa', ({ router }) => { if (state.protocol === 'OSPF' && document.body.classList.contains('expert') && G.nodes[router].tier !== 'intl') burst(lift(G.nodes[router].pos, 0.02), '#5fc4b0', 0.14, 0.7); });

/* ---------- scenarios + UI ---------- */
const ctx = { G, net, traffic, offices, view, flyTo, interdomain: createInterdomain() };
ctx.setLayer = initPanel(ctx);
ctx.failures = createFailures(ctx);
ctx.security = createSecurity(ctx);
ctx.demos = createRoutingDemos(ctx);
ctx.route = initRoute(ctx);
initFailures(ctx);
initSecurity(ctx);
ctx.inspector = initInspector(ctx);
initMetrics(ctx);
ctx.stories = initStories(ctx);
initSources();
ctx.debug = { scene };
const shell = ctx.shell = initShell(ctx);
shell.qualityLevel = () => qualityState.level;
// satellites follow the shell's clock; PakSat links are redrawn when PakSat-MM1 moves
let satLinksAt = 0;
initSatellites(shellClock, () => { if (performance.now() - satLinksAt > 5000) { satLinksAt = performance.now(); view.refreshSatLinks(); } });
ctx.setLayer('satellite', true);
ctx.satui = initSatelliteUI(ctx);
ctx.trace = initTraceroute(ctx);
initGlossary();
ctx.scen = initScenarios(ctx);
ctx.tour = initTour(ctx);
// Watch the story: the film-like player (it owns the keyboard while it plays)
ctx.watch = initWatch(ctx);
{ const tk = shell.keyHook; shell.keyHook = ev => ctx.watch.key(ev) || tk?.(ev); }
ui('btnWatch').onclick = () => ctx.watch.start();
on('metrics:sample', m => { ctx.lastSample = m; });

const { SCEN } = ctx.failures, { runHijack, runDDoS, runMalware } = ctx.security;
window.__flyTo = flyTo;
window.__sim = { SCEN, runHijack, runDDoS, runMalware, setTab, traceRoute: ctx.route.traceRoute, countToInfinity: ctx.demos.countToInfinity, setLayer: ctx.setLayer, inspect: name => ctx.inspector.open(G.N(name)),
  // debug: advance the simulation by `seconds` of wall time without waiting for frames
  tick: (seconds = 1) => { for (let t = 0; t < seconds; t += 1 / 60) stepWorld(state.speed / 60); },
  traffic, net, interdomain: ctx.interdomain, stories: () => ctx.stories, shell, G, pose };
// Screenshot set-ups used by scripts/verify.mjs (each resolves once the camera has arrived).
const settle = (ms = 2500) => new Promise(r => setTimeout(r, ms));
window.__paknet = { ctx, debug: { scene, camera, renderer, cityState, qualityState, tileState }, shots: {
  'start': async () => { shell.start(true); await settle(500); },
  'pakistan': async () => { shell.start(true); await flyTo('pakistan', 10); await settle(1500); },
  'karachi': async () => { shell.start(true); await flyTo({ lat: 24.86, lon: 67.0, range: 25, tilt: 50, heading: 10 }, 10); await settle(9000); },
  'city-300m': async () => { shell.start(true); await flyTo({ lat: 24.85, lon: 67.02, range: 0.6, tilt: 60, heading: 20 }, 10); await settle(6000); },
  'info-card': async () => { shell.start(true); shell.searchGo('AAE-1'); await settle(3500); },
  'sat-far': async () => { shell.start(true); shell.searchGo('PakSat-MM1'); await settle(4500); },
  'paksat-close': async () => { shell.start(true); await flyTo(PAKSAT_VIEW(), 10); await settle(3000); },
  'watch': async () => { ctx.watch.start(1); await settle(12000); },
  'sat-near': async () => { shell.start(true); shell.closeInfo(); shell.searchGo('Starlink'); await settle(4500); },
  'traceroute': async () => { shell.start(true); const o = offices.byKey.karachi; ctx.trace.open('karachi', 'youtube'); await flyTo({ lat: o.lat, lon: o.lon, range: 1.1, tilt: 58, heading: 25 }, 10); await settle(9000); },
  'traceroute-pk': async () => { shell.start(true); ctx.trace.open('karachi', 'whatsapp'); await flyTo('pakistan', 10); await settle(3000); },
  'scenario-aae1': async () => { ctx.tour.finish(); ctx.scen.start('aae1'); await settle(9000); },
  'scenario-kkh': async () => { ctx.scen.start('kkh'); await settle(14000); },
  'scenario-ddos': async () => { ctx.scen.start('ddos'); await settle(16000); },
  'scenario-hijack': async () => { ctx.scen.start('hijack'); await settle(12000); },
  'scenario-rip': async () => { ctx.scen.start('rip'); await settle(14000); },
  'tour-1': async () => { ctx.scen.stop(true); shell.closeInfo(); ctx.trace.close(); ctx.tour.startTour(); await settle(3500); },
  'tour-3': async () => { ctx.tour.go(2); await settle(3500); },
  'tour-8': async () => { ctx.tour.go(7); await settle(3500); ctx.tour.finish(); },
  'present': async () => { ctx.tour.startPresent(); ctx.tour.go(1); await settle(3500); },
  'expert': async () => { ctx.tour.finish(); ctx.scen.stop(true); shell.closeInfo(); shell.setExpert(true); await flyTo('pakistan', 10); await settle(2500); } // last shot: Expert stays on for the screenshot
} };
// every screenshot set-up starts clean: the story player and any scenario left over from a test step aside
for (const [k, f] of Object.entries(window.__paknet.shots)) if (k !== 'watch') window.__paknet.shots[k] = async () => { ctx.watch?.leave(false); if (!k.startsWith('scenario') && ctx.scen.current) ctx.scen.stop(true); return f(); };

// Zoom check for verify: from 27,000 km down to 300 m over Karachi in 48 steps,
// rendering each step and measuring the average screen brightness. A black frame
// or a sudden pop shows up as a drop or jump between neighbouring steps.
const probeCanvas = document.createElement('canvas'); probeCanvas.width = 48; probeCanvas.height = 30;
function probeLuma() {
  renderer.render(scene, camera); const c = probeCanvas.getContext('2d', { willReadFrequently: true });
  c.drawImage(renderer.domElement, 0, 0, 48, 30); const d = c.getImageData(0, 0, 48, 30).data; let s = 0;
  for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return s / (d.length / 4);
}
// Memory check for verify: geometries/textures before a city visit, inside, and after leaving.
window.__paknet.cityMemoryTest = async () => {
  shell.start(true); const mem = () => ({ ...renderer.info.memory });
  setPose({ lat: 29.2, lon: 69.4, range: 2700, heading: 0, tilt: 18 }); await settle(1500); const before = mem();
  setPose({ lat: 24.8495, lon: 67.0105, range: 1.1, heading: 25, tilt: 58 }); await settle(4000); const inside = { ...mem(), city: !!cityState.loaded.karachi };
  setPose({ lat: 29.2, lon: 69.4, range: 2700, heading: 0, tilt: 18 }); await settle(11000); const after = { ...mem(), city: !!cityState.loaded.karachi };
  return { before, inside, after };
};
// Scenario smoke test for verify: every scenario from start to "What did we learn?" by stepping
// through its beats (1.5 s of real time per scenario), recording errors and the final sentence.
window.__paknet.scenarioSmoke = async () => {
  shell.start(true); const out = {};
  for (const id of ctx.scen.ORDER) {
    try {
      ctx.scen.start(id); await settle(800);
      for (let k = 0; k < 12 && !document.querySelector('#scen .learn'); k++) { ctx.scen.stepNext(); await settle(120); }
      out[id] = { learned: !!document.querySelector('#scen .learn'), metric: document.getElementById('scMetric')?.textContent || '' };
    } catch (e) { out[id] = { error: e.message }; }
    ctx.scen.stop(true);
  }
  return out;
};
// verify: one press of Watch plays every chapter to the end with no input (fast, to keep the run short)
window.__paknet.watchTest = async (speed = 4, timeoutMs = 240000) => {
  ctx.watch.start(); ctx.watch.setSpeed(speed); const t0 = performance.now(), seen = new Set();
  while (ctx.watch.on && performance.now() - t0 < timeoutMs) { seen.add(ctx.watch.chapter); await new Promise(r => setTimeout(r, 250)); }
  const done = !ctx.watch.on; if (!done) ctx.watch.leave(); ctx.watch.setSpeed(1);
  return { done, chapters: ctx.watch.chapters, seen: seen.size, ms: Math.round(performance.now() - t0) };
};
window.__paknet.setPoseForTest = p => { shell.start(true); setPose(p); }; // screenshots of one place (scripts, verify)
window.__paknet.setStep = i => { const r0 = 27000, r1 = 0.3, N = 48; setPose({ lat: 24.86, lon: 67.02, range: r0 * Math.pow(r1 / r0, i / N), heading: 0, tilt: Math.min(55, i * 1.6) }); };
window.__paknet.zoomTest = async (stepMs = 0) => {
  shell.start(true); const out = []; const r0 = 27000, r1 = 0.3, N = 48;
  for (let i = 0; i <= N; i++) {
    setPose({ lat: 24.86, lon: 67.02, range: r0 * Math.pow(r1 / r0, i / N), heading: 0, tilt: Math.min(55, i * 1.6) });
    updateTiles(); setLift(Math.min(3, Math.max(0.002, altitudeKm * 0.0015)));
    if (stepMs) await new Promise(r => setTimeout(r, stepMs));
    await new Promise(r => requestAnimationFrame(r)); out.push(+probeLuma().toFixed(1)); if (window.__paknet.captureSteps?.includes(i)) (window.__paknet.captures ||= {})[i] = renderer.domElement.toDataURL('image/jpeg', 0.8); window.__paknet.zoomTestHook?.(); (window.__paknet.zoomDetail ||= []).push(`${i} ${pose.range.toFixed(0)}km ${tileDebug()} calls=${renderer.info.render.calls}`); if (window.__paknet.debugZoom) console.log('step', i, out.at(-1), pose.range.toFixed(1), tileDebug());
  }
  return out;
};

/* ---------- main loop ---------- */
const fmtClock = h => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
let last = performance.now(), lastNet = null;
const VERIFY = new URLSearchParams(location.search).has('verify'); let peakCalls = 0;

// Bursts where bundles are lost (tail drop, cut link, blocked) or swallowed by a sink.
// Only in Expert mode, where the loss numbers are shown too; for everyone else these
// unexplained red rings were noise (they come back, explained, in the stories that need them).
const expertOn = () => document.body.classList.contains('expert');
const lastFx = {}, rate = (k, ms) => { const t = performance.now(); if (t - (lastFx[k] || 0) < ms) return false; lastFx[k] = t; return true; };
let dropExplained = false;
const packetEvents = {
  drop: b => {
    if (!expertOn() || !rate('drop', 120)) return;
    burst(packetPos(b, b.d), '#e5484d', 0.1, 0.5);
    if (!dropExplained) { dropExplained = true; note('<b>Red flash</b>: a parcel was dropped here (the link was full, or cut). The loss numbers count these.'); }
  },
  arrive: b => {
    if (expertOn() && b.opt.sink && Math.random() < 0.2) burst(packetPos(b, b.d), '#e5484d', 0.22, 0.6);
    // an office's parcel reaching a place in Pakistan: a soft pulse where it arrives (never more than a few a second)
    else if (b.opt.office && !b.edges.at(-1)?.onward && rate('arrive', 250)) burst(packetPos(b, b.d), b.color, 0.035, 0.6);
    // leaving Pakistan by cable: carry on along the same cable to its landing abroad, at the hop's own speed
    const e = b.edges.at(-1);
    if (e?.onward && b.seq.at(-1) === e.b) sendOnward(e, b.color, e.gcum.at(-1) / Math.max(1e-6, edgeDelayMs(e)), b.opt.dest === 'whatsapp'); // km per ms of network time
  }
};

// Advance everything that runs on simulated time by sdt (wall seconds × speed):
// attack traffic, RIP rounds and OSPF events (each on its own compressed clock) and the packet engine.
let dvClock = 0;
function stepWorld(sdt) {
  if (sdt > 0) {
    ctx.security.spawn(sdt);
    dvClock += sdt; while (dvClock >= DV_ROUND_S) { dvClock -= DV_ROUND_S; net.dvRound(); }
    net.lsAdvance(sdt);
    ctx.interdomain.advance(sdt);
  }
  traffic.advance(sdt, packetEvents);
}

function frame(now) {
  const rawMs = now - last; const dt = Math.min(0.05, rawMs / 1000); last = now;
  updateTour(); updateCamera(dt); updateGlobe(); updateTiles(); updateSatellites(); updatePaksat3d(); updateCity(G.OFFICES); updateLandmarks();
  document.body.classList.toggle('city-on', Object.keys(cityState.loaded).length > 0); // OSM credit while buildings are shown
  // our own road overlay when the imagery has no road labels: eased in below ~1,400 km
  const rl = layers.roads?.userData.lines;
  if (rl) { const want = tileState.labels !== 'provider' ? (1 - THREE.MathUtils.smoothstep(altitudeKm, 350, 1400)) * 0.38 : 0; rl.material.opacity += (want - rl.material.opacity) * Math.min(1, dt * 4); rl.visible = rl.material.opacity > 0.01; document.body.classList.toggle('roads-on', rl.visible); }
  // Slow motion near the ground: a 1 km hop takes microseconds of network time, so
  // close up the simulation runs slower (down to 1/300) and you can watch each hop.
  // The time of day is not affected (shell clock), and offices keep sending steadily.
  const slow = ctx.scen.current ? 1 : Math.min(1, Math.max(1 / 300, altitudeKm / 250)); // scenarios run in real time
  const sdt = state.playing ? dt * state.speed * slow : 0;
  if (state.playing) offices.spawn(dt);
  setTrailStep(Math.min(0.035, Math.max(0.00004, altitudeKm * 0.00012)));
  const slowEl = ui('tbSlow'); if (slowEl) { const on = slow < 0.9; slowEl.classList.toggle('on', on); if (on) slowEl.innerHTML = 'Slowed down<span class="w"> so you can watch</span>'; }
  // lift the network a little above the ground: metres in a city, a few km from space
  setLift(Math.min(3, Math.max(0.002, altitudeKm * 0.0015)));
  // network markers shrink when far away so the globe stays calm from space
  const s = Math.max(0.45, Math.min(1, 1.25 - Math.log10(Math.max(1, pose.range)) * 0.17));
  glyphUniforms.uScale.value = s; packetUniforms.uScale.value = Math.max(0.6, s);
  shell.frame(dt, rawMs);
  watchFrame(rawMs);
  if (state.playing && ui('kClock')) ui('kClock').textContent = fmtClock(state.simHour);
  stepWorld(sdt);
  drawPackets(traffic.packets);
  const netNow = traffic.engine.now; updateOnward(netNow - (lastNet ?? netNow), 2 * pose.range * Math.tan(camera.fov * Math.PI / 360) / innerHeight); lastNet = netNow;
  view.satLinkFade(altitudeKm, paksatShownNow()); view.borderFade(altitudeKm);
  updateFx(dt); updateFades(dt); // after the effects, so a fade wins over their own opacity for its 300 ms
  ctx.scen.frame(Math.min(0.25, rawMs / 1000)); // the story clock follows wall time, even on a slow frame
  ctx.watch.tick(Math.min(0.25, rawMs / 1000));
  updateLabels(layers);
  ctx.inspector.frame();
  renderer.render(scene, camera); if (hasCallouts()) labelRenderer.render(scene, camera);
  // verify only: what was drawn in the frame with the most draw calls so far
  if (VERIFY && renderer.info.render.calls > peakCalls) { peakCalls = renderer.info.render.calls; const c = {}; scene.traverseVisible(o => { if (o.isMesh || o.isPoints || o.isLine) { let n = o, k = ''; while (n && !k) { k = n.name; n = n.parent; } c[k || o.type] = (c[k || o.type] || 0) + 1; } }); window.__paknetStats.maxWhat = { calls: peakCalls, ...c, tiles: tileDebug() }; }
  requestAnimationFrame(frame);
}

if (!shell.readHash()) { setPose({ lat: 21, lon: 18, range: 27000, heading: 0, tilt: 0 }); spin.stopAt = 64; }
requestAnimationFrame(frame);
window.__paknetTiming.built = Math.round(performance.now() - T0);
globeReady.then(() => { window.__paknetTiming.textures = Math.round(performance.now() - T0); requestAnimationFrame(() => { window.__paknetTiming.firstFrame = Math.round(performance.now() - T0); window.__paknetReady = true; }); });

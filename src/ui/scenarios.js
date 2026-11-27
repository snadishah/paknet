// Scenarios for everyone (docs/REDESIGN.md Phase 5). Each one starts from one
// click, plays in ≤ 45 s, can be paused and stepped, tells a 3-sentence story a
// child can follow (stories/kids.js), shows one distinct animation
// (render/scenefx.js), measures one before/after number in plain words, keeps the
// technical detail under "Expert", and ends with "What did we learn?".
// Everything that happens to the network goes through the real simulation.
import { state } from '../state.js';
import { on } from '../events.js';
import { ui } from './dom.js';
import { gloss } from './glossary.js';
import { setProtocol } from './failures.js';
import { KIDS } from '../stories/kids.js';
import { flyTo } from '../render/globecam.js';
import { fromLatLon } from '../render/geo3.js';
import { setAttackGrey } from '../render/packets.js';
import { clearBursts } from '../render/fx.js';
import { edgeCapacityGbps, edgeDelayMs } from '../sim/links.js';
import { KM_PER_UNIT, ecefToLatLon } from '../geo/globe.js';
import * as fx from '../render/scenefx.js';
import { patchHtml } from './fades.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = x => `${Math.round(x * 100)}%`;
const f1 = x => (x == null ? '—' : x.toFixed(1));

export function initScenarios(ctx) {
  const { G, net, traffic, shell, failures, security } = ctx;
  const kit = () => ctx.stories.kit;
  const N = n => G.N(n), cable = id => G.CABLES.find(c => c.id === id);
  const busiest = () => Math.max(0, ...G.cableEdges.filter(e => net.usable(e)).map(e => e.util || 0));
  const loss = () => ctx.lastSample?.lossPct ?? 0;
  const routeKm = (a, b) => { const r = net.route(a.id, b.id); return r ? r.edges.reduce((s, e) => s + e.len * KM_PER_UNIT, 0) : null; };
  const routeMs = (a, b) => { const r = net.route(a.id, b.id); return r ? r.edges.reduce((s, e) => s + edgeDelayMs(e), 0) : null; };
  // at: where the real fault was ({ lat, lon }), so the mark is drawn there and not just near Karachi
  const cutCable = (id, at = null, via = null) => { const c = cable(id); c.edges.forEach(e => { e.cutAt = at; e.cutVia = via; }); c.edges.forEach(net.cutEdge); net.topologyChanged(c.edges, 'BGP'); return c.edges[0].cutPos || c.edges[0].gpts[Math.floor(c.edges[0].gpts.length * 0.3)]; };

  // ---------- the ten scenarios ----------
  // beats: [seconds, fn(s)]; phases: when to show the kid sentences; metric(s) → plain words.
  const S = {
    aae1: {
      camera: { lat: 24.8, lon: 58.5, range: 2700, tilt: 25, heading: 0 }, dur: 30, phases: [0, 6, 14], // Qatar and Karachi in view
      before: s => { s.cap0 = traffic.intlCapacityTbps(); s.u0 = busiest(); },
      beats: [[3, s => { const p = cutCable('AAE1', { lat: 25.9, lon: 52.3 }, [[25.12, 56.33], [25.9, 56.62], [26.6, 56.55], [26.45, 55.2]]); /* its branch into the Gulf towards Qatar (not in the route data): from Fujairah round Musandam to the fault */ fx.spark(p); fx.glow(p); }], [5, () => ctx.setLayer('heat', true)], [16, () => flyTo({ lat: 24.4, lon: 66.3, range: 700, tilt: 35 })]],
      metric: s => `Room on the sea roads: ${f1(s.cap0)} → ${f1(traffic.intlCapacityTbps())} trillion bits a second. Busiest cable: ${pct(s.u0)} → ${pct(busiest())} full.`,
      expert: () => [['Cut', 'AAE-1, both directions (Jan 2025 fault near Qatar)'], ['Routing', 'BGP re-convergence (timer, see CLAUDE.md "mocked")'], ['Model', 'Operators move traffic to their other cables (PTCL: IMEWE, SMW4)']]
    },
    redsea: {
      camera: { lat: 19.8, lon: 41, range: 2600, tilt: 22, heading: 0 }, dur: 38, phases: [0, 9, 20],
      before: s => { s.cap0 = traffic.intlCapacityTbps(); s.u0 = busiest(); },
      beats: [
        [3, () => { const p = fromLatLon(21.4, 38.95); cutCable('SMW4', { lat: 21.4, lon: 38.95 }); fx.spark(p); fx.glow(p, { sizeKm: 160 }); }],
        [6, () => { const p = fromLatLon(21.1, 38.85); cutCable('IMEWE', { lat: 21.1, lon: 38.85 }); fx.spark(p); fx.glow(p, { sizeKm: 160 }); }],
        [12, () => { const p = fromLatLon(19.6, 38.4); cutCable('PEACE', { lat: 19.6, lon: 38.4 }); fx.spark(p); fx.glow(p, { sizeKm: 160 }); shell.hint('Six weeks later, near Sudan, one more cable broke.', 4000); }],
        [15, () => ctx.setLayer('heat', true)], [20, () => flyTo({ lat: 23.8, lon: 63.5, range: 1700, tilt: 28 })]],
      metric: s => `Room on the sea roads: ${f1(s.cap0)} → ${f1(traffic.intlCapacityTbps())} trillion bits a second. Busiest cable left: ${pct(busiest())} full (was ${pct(s.u0)}).`,
      expert: () => [['Sep 2025', 'SMW4 + IMEWE cut near Jeddah (SMW5, AAE-1, PEACE unaffected)'], ['20 Oct 2025', 'PEACE cut near Sudan (separate event, shown in sequence)'], ['Cut points', 'Red Sea positions drawn on the illustrative onward route']]
    },
    kkh: {
      camera: { lat: 35.25, lon: 74.0, range: 380, tilt: 42, heading: 10 }, dur: 36, phases: [0, 9, 26],
      before: s => { s.fib = edgeCapacityGbps(G, kkhFibre()); s.mw = edgeCapacityGbps(G, G.edges.find(e => e.type === 'mwbackup')); },
      beats: [
        [1, () => fx.rocks(35.45, 74.05, 210)],
        [3.5, () => { const e = kkhFibre(), slide = fromLatLon(35.37, 74.0), at = e.gpts.reduce((a, p) => (p.distanceTo(slide) < a.distanceTo(slide) ? p : a)); e.cutAt = ecefToLatLon(at.x, at.y, at.z); net.cutEdge(e); /* the break is where the rocks reach the road */ net.topologyChanged([e], 'OSPF'); ctx.setLayer('microwave', true); fx.spark(e.cutPos || e.gpts[0]); }],
        [11, s => { s.towerTimer = setInterval(() => { if (!state.playing) return; const e = G.edges.find(x => x.type === 'mwbackup' && !x.cut); if (!e) { clearInterval(s.towerTimer); return; } net.cutEdge(e); net.topologyChanged([e], 'OSPF'); fx.spark(e.gpts[e.gpts.length - 1], 3); }, 450); }],
        [26, () => flyTo('pakistan')]],
      metric: s => `Road to China: big glass cable (${Math.round(s.fib)} billion bits a second) → radio towers (${Math.round(s.mw)} billion) → none. China-bound parcels now wait; the rest use the sea cables.`,
      stop: s => clearInterval(s.towerTimer),
      expert: () => [['Cut', 'KKH fibre Chilas–Gilgit, then the 26-link microwave backup, tower by tower (illustrative landslide)'], ['Routing', 'OSPF re-converges after each cut']]
    },
    gwadar: {
      imaginary: true, camera: { lat: 24.2, lon: 61.2, range: 1300, tilt: 25, heading: 0 }, dur: 30, phases: [0, 4, 14],
      before: s => { s.km0 = routeKm(N('Gwadar'), G.INTL.W); s.ms0 = routeMs(N('Gwadar'), G.INTL.W); },
      beats: [[3, () => fx.drawLine(G.plannedEdges[0].gpts, { dur: 5 })], [8.5, () => { if (!state.plannedActive) failures.SCEN.gwadar(); }]],
      metric: s => { const km = routeKm(N('Gwadar'), G.INTL.W), ms = routeMs(N('Gwadar'), G.INTL.W); return `From Gwadar to the Gulf: ${Math.round(s.km0).toLocaleString()} km → ${Math.round(km).toLocaleString()} km of cable, ${f1(s.ms0)} → ${f1(ms)} thousandths of a second. (Imaginary.)`; },
      stop: () => { if (state.plannedActive) failures.SCEN.gwadar(); ui('scGwadar')?.classList.remove('on'); },
      expert: () => [['What-if', 'Gwadar landing + CPEC Phase II fibre (not built; progress unverified)'], ['Measured', 'Shortest route Gwadar → Gulf endpoint, before and after']]
    },
    ddos: {
      camera: { lat: 31.3, lon: 73.6, range: 700, tilt: 30, heading: 0 }, dur: 40, phases: [0, 5, 16],
      before: s => { kit().setDefence(true); setAttackGrey(true); },
      beats: [[1.9, s => { s.loss0 = loss(); s.peak = s.loss0; }], [2, () => security.runDDoS()]],
      tick: s => { if (s.t > 2.5) s.peak = Math.max(s.peak, loss()); },
      onDefence: (s, e) => {
        if (e.kind !== 'ddos') return; const n = G.DCS[1];
        if (e.phase === 'analyse' && !s.bell) s.bell = fx.bubble(n.gpos, '<svg viewBox="0 0 20 20" width="22" height="22"><path d="M10 2a5 5 0 0 0-5 5v3l-2 3h14l-2-3V7a5 5 0 0 0-5-5zM8 15a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg> Alarm!', 'bub bell');
        if (e.phase === 'execute') { s.bell?.set('Shield up: the crowd goes to a filter'); s.healAt = s.t; }
      },
      metric: s => (s.loss0 == null ? '' : `Lost parcels for real people: ${f1(s.loss0)}% before, ${f1(s.peak)}% at the worst, ${f1(loss())}% now.`),
      stop: () => setAttackGrey(false),
      expert: () => [['Attack', '8 Tbps on the cables + a botnet in Pakistan, aimed at the Lahore CDN edge (illustrative)'], ['Detect', 'EWMA z-score on volume + source entropy'], ['Respond', 'Divert to the scrubbing centre (TWA data centre, illustrative)']]
    },
    phones: {
      camera: { lat: 34.15, lon: 72.1, range: 260, tilt: 38, heading: 0 }, dur: 34, phases: [0, 7, 18],
      before: s => { kit().setDefence(true); const m = N('Mardan'); s.phones = Array.from({ length: 12 }, (_, i) => fromLatLon(m.lat + Math.sin(i * 2.4) * 0.12 * (0.4 + (i % 4) / 4), m.lon + Math.cos(i * 2.4) * 0.14 * (0.4 + (i % 3) / 3), 0.5)); },
      beats: [[1, s => fx.lightUp(s.phones)], [4, s => { security.runMalware(); s.t0 = s.t; }], [6, s => { const srv = fromLatLon(25.2, 55.27); fx.serverMark(srv, 'Command server (illustrative, abroad)'); s.lines = fx.signalLines(s.phones, srv); }]],
      onDefence: (s, e) => { if (e.kind === 'beacon' && e.phase === 'execute' && !s.found) { s.found = s.t; if (s.lines) s.lines.found = true; fx.bubble(N('Mardan').gpos, 'Spotted! Phones blocked', 'bub ok'); } },
      metric: s => (s.found ? `The guard spotted the secret calls ${f1(s.found - s.t0)} s after they began, and blocked the phones.` : 'The guard is still listening for the secret calls.'),
      expert: () => [['Signal', 'Beacon periodicity: calls to one server at a fixed rhythm'], ['Respond', 'Quarantine + step-up authentication (adaptive access control)'], ['Note', 'Illustrative scenario']]
    },
    hijack: {
      camera: { lat: 32, lon: 48, range: 9500, tilt: 0, heading: 0 }, dur: 42, phases: [0, 8, 30],
      before: s => { kit().setDefence(false); s.max = 0; s.w0 = ctx.interdomain.worldHijackedShare?.() ?? 0; },
      beats: [[2, () => security.runHijack()], [3, () => fx.waves(N('Karachi').gpos, { size: 22, count: 5, every: 0.8, life: 3 })],
        [7, s => { s.counter = fx.bubble(N('Karachi').gpos, '', 'bub'); }],
        [30, () => fx.bubble(fromLatLon(22, 60), '<b>✓ Stamp of approval (RPKI)</b><br>With today\'s rules, the fake sign would be rejected.', 'bub ok')]],
      tick: s => { const w = ctx.interdomain.worldHijackedShare?.() ?? 0; s.max = Math.max(s.max, w); s.wNow = w; s.counter?.set(`YouTube parcels lost here: <b>${pct(w)}</b>`); },
      metric: s => `YouTube users whose parcels went the wrong way: ${pct(s.w0)} before, ${pct(s.max)} at the worst, ${pct(s.wNow ?? 0)} now (model of 15 networks).`,
      expert: () => [['2008', 'AS17557 (PTCL) announced 208.65.153.0/24; leaked via AS3491 (PCCW)'], ['Model', 'Simplified BGP on 15 ASes, compressed time'], ['RPKI', 'What-if: the /22 has ROAs today, so the /24 would be Invalid']]
    },
    facebook: {
      camera: { lat: 38, lon: 45, range: 14000, tilt: 0, heading: 0 }, dur: 38, phases: [0, 6, 24],
      before: s => { kit().setDefence(false); kit().fbWorld(); s.r0 = ctx.interdomain.fbReachableShare(); },
      beats: [
        [2, s => { const fb = fromLatLon(65.6, 22.1); s.fbLabel = fx.bubble(fb, 'Facebook (illustrative location)', 'bub'); s.roads = fx.fadingRoads([N('Karachi'), N('Lahore'), N('Islamabad')].map(n => n.gpos).concat([fromLatLon(43.3, 5.4), fromLatLon(1.3, 103.8), fromLatLon(25.2, 55.3), fromLatLon(40.7, -74), fromLatLon(-23.5, -46.6)]), fb, { start: 2, dur: 5 }); }],
        [4, () => kit().bgp(60000, 'fbWithdraw', true)],
        [7, () => fx.circling([N('Karachi'), N('Lahore'), N('Islamabad')].map(n => n.gpos), { dur: 12, radiusKm: 90 })],
        [24, s => { kit().bgp(5 * 3600000 + 21 * 60000, 'fbReturn', true); s.back = ctx.interdomain.fbReachableShare(); shell.hint('About six hours later…', 3000); }]],
      tick: s => { if (!s.mid && s.t > 9) s.mid = ctx.interdomain.fbReachableShare(); },
      metric: s => `People in Pakistan who could find Facebook: ${pct(s.r0)} → ${pct(s.mid ?? 0)} → ${pct(s.back ?? ctx.interdomain.fbReachableShare())}.`,
      expert: () => [['4 Oct 2021', 'Backbone command error; DNS prefixes withdrawn from BGP'], ['Model', 'FB DNS prefixes withdrawn by AS32934 and re-announced ~5 h 21 min later'], ['Location', 'The Facebook point is illustrative']]
    },
    rip: {
      camera: 'cti', dur: 40, phases: [0, 6, 24],
      before: s => { s.dvPrev = { ...net.dv.opts }; net.setDVOptions({ splitHorizon: false, poisonReverse: false }); s.rounds = 0; },
      beats: [[2, s => { ctx.demos.countToInfinity(); s.start = net.dv.round; s.a = fx.bubble(N('Nok Kundi').gpos, '', 'bub big'); s.b = fx.bubble(N('Dalbandin').gpos, '', 'bub big'); }]],
      onRound: s => {
        const T = N('Taftan'); if (!s.a) return; const show = (b, r) => { const d = net.dv.distance(r.id, T.id); b.set(d >= 16 ? '16 = no road!' : `"${d} steps"`); b.flash(); };
        show(s.a, N('Nok Kundi')); show(s.b, N('Dalbandin')); s.rounds = net.dv.round - s.start;
      },
      metric: s => {
        if (!s.a) return '';
        const T = N('Taftan'), done = [N('Nok Kundi'), N('Dalbandin')].every(r => net.dv.distance(r.id, T.id) >= 16);
        return done ? `The two routers argued for ${s.rounds} rounds (about ${Math.round(s.rounds * 0.5)} minutes in real RIP) before saying "no road".` : `Round ${s.rounds}: they are still counting up…`;
      },
      stop: s => { ctx.demos.restoreLink(); setProtocol('OSPF'); net.setDVOptions({ splitHorizon: !!s.dvPrev?.splitHorizon, poisonReverse: !!s.dvPrev?.poisonReverse }); for (const [id, k] of [['dvSH', 'splitHorizon'], ['dvPR', 'poisonReverse']]) { const c = ui(id); if (c) c.checked = !!s.dvPrev?.[k]; } },
      expert: () => [['Protocol', 'RIP (distance vector), hop count, infinity = 16'], ['Cut', 'Nok Kundi–Taftan; split horizon and poison reverse off'], ['Time', 'One round = RIP\'s 30 s timer, compressed']]
    },
    ospf: {
      camera: { lat: 30.4, lon: 72.2, range: 950, tilt: 25, heading: 0 }, dur: 30, phases: [0, 4, 12],
      before: s => { setProtocol('OSPF'); },
      beats: [[2.5, s => { const e = ospfLink(); net.cutEdge(e); net.topologyChanged([e], 'OSPF'); s.watch = fx.bubble(e.gpts[Math.floor(e.gpts.length / 2)], '⏱ news spreading…', 'bub big'); s.lsa = true; }]],
      onLsa: (s, router) => { const n = G.nodes[router]; if (n.tier !== 'intl') fx.waves(n.gpos, { color: '#5fc4b0', size: 0.35, count: 1, life: 1.2 }); },
      onConverged: (s, r) => { if (!s.conv) { s.conv = r.totalMs; s.watch?.set(`⏱ all routers agree: ${Math.round(r.totalMs)} ms`); } },
      metric: s => (s.conv ? `Every router had the news and a new road after ${Math.round(s.conv)} ms (measured in the simulator, shown slowed down).` : 'The news is still spreading…'),
      expert: () => [['Protocol', 'OSPF: link-state flooding, SPF throttle'], ['Measured', 'Failure → last route install (Expert → Failures shows the breakdown)']]
    }
  };
  const kkhFibre = () => G.adj.get(N('Chilas').id).find(e => e.type === 'fiber' && [G.nodes[e.a].name, G.nodes[e.b].name].includes('Gilgit'));
  const ospfLink = () => G.adj.get(N('Multan').id).find(e => e.type === 'fiber' && [G.nodes[e.a].name, G.nodes[e.b].name].includes('Khanewal'));
  const ORDER = ['aae1', 'redsea', 'kkh', 'gwadar', 'ddos', 'phones', 'hijack', 'facebook', 'rip', 'ospf'];

  // ---------- the player ----------
  let cur = null; // { id, def, t, i (next beat), paused, ended }
  function reset() {
    fx.clearSceneFx(); clearBursts(); setAttackGrey(false);
    try { kit().reset(); } catch { /* kit not ready */ }
    ctx.setLayer('heat', false); ctx.setLayer('microwave', false); ctx.setLayer('planned', false);
    setProtocol('OSPF'); kit().setDefence(true);
  }
  function start(id) {
    stop(true); shell.closeInfo(); ctx.trace?.close();
    if (!shell.started) shell.start(true);
    reset();
    const def = S[id]; cur = { id, def, t: 0, i: 0, ended: false };
    def.before?.(cur);
    flyTo(def.camera, 2200);
    shell.setPlaying(true);
    render();
  }
  function stop(silent) {
    if (!cur) return; cur.def.stop?.(cur); cur = null;
    reset(); ui('scen').classList.remove('on'); document.body.classList.remove('scenario');
    if (!silent) flyTo('pakistan');
  }
  let lastStep = 0;
  function stepNext() { // jump to the next beat (or the end)
    if (!cur) return; const b = cur.def.beats[cur.i];
    cur.t = b ? Math.max(cur.t, b[0]) : cur.def.dur; fire();
    if (!b) cur.ended = true; // stepping past the last beat ends the story, even while paused
    render();
  }
  function fire() { const b = cur.def.beats; while (cur.i < b.length && b[cur.i][0] <= cur.t) { b[cur.i][1](cur); cur.i++; } }
  function phase() { const [, bad, heal] = cur.def.phases; return cur.ended ? 'learn' : cur.t >= heal ? 'heal' : cur.t >= bad ? 'bad' : 'what'; }
  let lastHtml = '';
  function render() {
    if (!cur) return; const k = KIDS[cur.id], ph = phase();
    const said = ['what', 'bad', 'heal'].slice(0, ['what', 'bad', 'heal', 'learn'].indexOf(ph) + 1);
    const html = `<div class="sh"><div><p class="kick">${cur.def.imaginary ? '<span class="tag warm">Imaginary scenario</span>' : 'What can go wrong?'}</p><h3>${esc(k.title)}</h3></div>
      <button class="sbtn x" id="scX" aria-label="Stop the scenario"><svg class="ico2"><use href="#s-close"/></svg></button></div>
      <ol class="story">${said.map((p, i) => `<li class="${i === said.length - 1 && !cur.ended ? 'now' : ''}"><b>${['What happens', 'Why it is bad', 'How it heals'][i]}</b>${gloss(k[p])}</li>`).join('')}</ol>
      ${cur.ended ? `<p class="learn"><b>What did we learn?</b> ${gloss(k.learn)}</p>` : ''}
      <p class="metric" id="scMetric"></p>
      <div class="bar" aria-hidden="true"><i style="width:${Math.min(100, cur.t / cur.def.dur * 100).toFixed(1)}%"></i></div>
      <div class="row"><button class="sbtn" id="scPlay">${state.playing ? 'Pause' : 'Play'}</button><button class="sbtn" id="scStep" ${cur.ended ? 'disabled' : ''}>Next step</button><button class="sbtn" id="scAgain">Start again</button><button class="chipbtn ghost" id="scStop">Done</button></div>
      <details id="scExp" ${document.body.classList.contains('expert') ? 'open' : ''}><summary>Expert details</summary><dl>${cur.def.expert().map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl></details>`;
    const key = html.replace(/width:[^%]+%/, '');
    if (key !== lastHtml) {
      lastHtml = key; patchHtml(ui('scen'), html); // details keep their open state
      ui('scX').onclick = () => stop(); ui('scStop').onclick = () => stop();
      // Again: the old run fades out first; Next step: at most one step every 0.7 s (each step's animation gets to start)
      ui('scAgain').onclick = () => { const id = cur.id; stop(true); setTimeout(() => start(id), 350); };
      ui('scPlay').onclick = () => { shell.setPlaying(!state.playing); render(); }; ui('scStep').onclick = () => { if (performance.now() - lastStep < 700) return; lastStep = performance.now(); stepNext(); };
    } else ui('scen').querySelector('.bar i').style.width = Math.min(100, cur.t / cur.def.dur * 100).toFixed(1) + '%';
    ui('scMetric').textContent = cur.t > 1 ? cur.def.metric(cur) : '';
    ui('scen').classList.add('on'); document.body.classList.add('scenario');
  }
  // called every frame by main.js
  let acc = 0;
  function frame(dt) {
    fx.updateSceneFx(dt);
    if (cur && cur.shownPlaying !== state.playing) { cur.shownPlaying = state.playing; render(); } // paused from the time bar / Space
    if (!cur || cur.ended || !state.playing) return;
    cur.t += dt; fire(); cur.def.tick?.(cur);
    if (cur.t >= cur.def.dur) { cur.ended = true; render(); return; }
    if ((acc += dt) > 0.25) { acc = 0; render(); }
  }
  on('defence:phase', e => { if (cur?.def.onDefence) { cur.def.onDefence(cur, e); render(); } });
  on('dv:round', () => cur?.def.onRound?.(cur));
  on('ospf:lsa', ({ router }) => cur?.def.onLsa?.(cur, router));
  on('ospf:converged', r => cur?.def.onConverged?.(cur, r));

  // ---------- picker (tools button), search and presentation slides ----------
  const menu = ui('menuScen');
  menu.innerHTML = '<h6>What can go wrong?</h6>' + ORDER.map(id => `<button class="mi" data-s="${id}"><b>${esc(KIDS[id].title)}</b><small>${esc(KIDS[id].what)}</small></button>`).join('');
  menu.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { menu.classList.remove('on'); ui('tScen').classList.remove('on'); ctx.watch?.leave(false); start(b.dataset.s); }); // one mode at a time
  ui('tScen').onclick = ev => { ev.stopPropagation(); const o = !menu.classList.contains('on'); menu.classList.toggle('on', o); ui('tScen').classList.toggle('on', o); ui('tScen').setAttribute('aria-expanded', o); };
  document.addEventListener('click', ev => { if (!ev.target.closest('#menuScen') && !ev.target.closest('#tScen')) { menu.classList.remove('on'); ui('tScen').classList.remove('on'); } });
  shell.addSearch({ name: 'Telesat Lightspeed', sub: 'Coming soon — none in orbit yet', go: () => shell.showInfo({ kick: 'Low-orbit internet satellites', title: 'Telesat Lightspeed', tags: [['Coming soon — not yet licensed in Pakistan (as of late 2026)', 'grey'], ['No satellites in orbit yet (CelesTrak, Nov 2026)', 'grey']], what: 'A planned swarm of internet satellites from Telesat (Canada).', why: 'None are flying yet, so there is nothing to show on the globe.' }) });
  for (const id of ORDER) shell.addSearch({ name: KIDS[id].title, sub: 'Scenario', go: () => start(id) });
  ctx.scenarioSlides = ORDER.map(id => ({ id: 'scen-' + id, text: KIDS[id].what, enter: () => start(id), leave: () => stop(true) }));

  return { start, stop, stepNext, frame, get current() { return cur?.id || null; }, get t() { return cur?.t ?? 0; }, get dur() { return cur?.def.dur ?? 1; }, get ended() { return !!cur?.ended; }, ORDER };
}

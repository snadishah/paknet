// The story engine (hand-rolled): a step = { id, text, camera, enter(), leave() }.
// Two front ends share it:
//  - the first-run tour (≤ 8 steps, skippable, replayable from "?"), a small card;
//  - presentation mode (P / the screen button): full screen, big caption bar,
//    arrow keys or a clicker to step, the cursor hidden.
// Captions live in stories/captions.js (tested for length and reading level).
import { ui } from './dom.js';
import { gloss } from './glossary.js';
import { TOUR, PRESENT, PRESENT_END } from '../stories/captions.js';
import { flyTo, VIEWS } from '../render/globecam.js';
import { burst } from '../render/fx.js';
import { satLayers, applyLayers } from '../render/satellites.js';
import { state } from '../state.js';
import { on } from '../events.js';
import { labelState } from '../render/labels.js';
import { patchHtml } from './fades.js';

const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

export function initTour(ctx) {
  const { G, shell, offices } = ctx;
  let pulseT = 0;
  const pulse = (nodes, color, s) => { clearInterval(pulseT); const go = () => nodes.forEach(n => burst(n.gpos, color, s, 1.1)); go(); pulseT = setInterval(go, 1300); };
  const stopPulse = () => clearInterval(pulseT);
  const office = () => offices.byKey.karachi;
  const officeView = () => ({ lat: office().lat, lon: office().lon, range: 1.1, tilt: 58, heading: 25 });
  const showFar = () => { if (!satLayers.far) { satLayers.far = true; applyLayers(); ctx.setLayer('satellite', true); } };

  // what each caption does on screen
  const DO = {
    earth: { camera: { lat: 20, lon: 58, range: 26000, heading: 0, tilt: 0 } },
    pakistan: { camera: 'pakistan' },
    packets: { camera: { lat: 30.9, lon: 72.9, range: 520, tilt: 35, heading: 0 } },
    cables: { camera: { lat: 23.4, lon: 65.2, range: 1500, tilt: 25, heading: 0 } },
    satellite: { camera: 'far', enter: showFar },
    routers: { camera: { lat: 31.45, lon: 74.2, range: 170, tilt: 40, heading: 0 }, enter: () => pulse(G.nodes.filter(n => n.tier === 'core'), '#f4f1ea', 0.09), leave: stopPulse },
    office: { camera: officeView(), enter: () => ctx.trace.open('karachi', 'youtube'), leave: () => ctx.trace.close() },
    try: { camera: 'pakistan', enter: () => { pulse(offices.OFFICES, '#f0c27a', 0.25); labelState.extra = l => (l.key.startsWith('office:') ? true : null); }, leave: () => { stopPulse(); labelState.extra = null; } },
    // presentation
    space: { camera: { lat: 20, lon: 58, range: 26000, heading: 0, tilt: 0 } },
    satellites: { camera: 'far', enter: showFar },
    defence: { camera: 'pakistan', enter: () => shell.showInfo(DEFENCE_CARD), leave: () => shell.closeInfo() }
  };
  const DEFENCE_CARD = {
    kick: 'The defence loop (MAPE-K)', title: 'A guard that learns',
    what: gloss('Our guard does four things, again and again: it watches the traffic, thinks about what is odd, plans a fix and acts.'),
    why: gloss('It keeps what it learns, so next time it is faster. This idea comes from adaptive security research.'),
    expert: () => [['Monitor', 'Flow telemetry at the edge + BGP routes seen by carriers'], ['Analyse', 'EWMA z-score (volume), source entropy, beacon periodicity, RPKI origin validation'], ['Plan / Execute', 'Divert to scrubbing, quarantine + step-up auth, ROV at carriers'], ['Knowledge', 'Every run is logged; Expert → Security compares defence off vs on']]
  };

  const run = { steps: null, i: -1, mode: null };
  const stepOf = c => ({ ...c, ...(DO[c.id] || {}) });

  function go(i) {
    const steps = run.steps; if (!steps) return;
    if (run.i >= 0) steps[run.i]?.leave?.();
    if (i >= steps.length) { finish(); return; }
    run.i = Math.max(0, i); const s = steps[run.i];
    if (s.camera) flyTo(typeof s.camera === 'function' ? s.camera() : s.camera, run.mode === 'present' ? 2600 : 2200);
    s.enter?.();
    render();
  }
  function render() {
    const s = run.steps[run.i], n = run.steps.length, last = run.i === n - 1;
    if (run.mode === 'tour') {
      patchHtml(ui('tourcard'), `<p class="cap">${gloss(s.text)}</p>
        <div class="row"><div class="dots" aria-hidden="true">${run.steps.map((_, k) => `<i class="${k === run.i ? 'on' : ''}"></i>`).join('')}</div>
        <span class="count">${run.i + 1} of ${n}</span>
        <button class="sbtn" id="tcBack" ${run.i ? '' : 'disabled'}>Back</button><button class="chipbtn" id="tcNext">${last ? 'Finish' : 'Next'}</button></div>
        <button class="skip" id="tcSkip">Skip the tour</button>`);
      ui('tourcard').classList.add('on');
      ui('tcBack').onclick = () => go(run.i - 1); ui('tcNext').onclick = () => go(run.i + 1); ui('tcSkip').onclick = finish;
      ui('tcNext').focus({ preventScroll: true });
    } else {
      patchHtml(ui('capbar'), `<p>${gloss(s.text)}</p><span>${run.i + 1} / ${n} · ← → to move · Esc to leave</span>`);
      ui('capbar').classList.add('on');
    }
  }
  function finish() {
    if (run.i >= 0) run.steps?.[run.i]?.leave?.();
    const mode = run.mode; run.steps = null; run.i = -1; run.mode = null;
    ui('tourcard').classList.remove('on'); ui('capbar').classList.remove('on');
    document.body.classList.remove('touring', 'presenting');
    if (mode === 'tour') { store.set('paknet.tourSeen', '1'); shell.hint('Click an office, a cable or a city to learn more. Press ? to see the tour again.', 6000); }
    if (mode === 'present' && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }

  function startTour() {
    if (run.mode) finish();
    run.mode = 'tour'; run.steps = TOUR.map(stepOf); document.body.classList.add('touring');
    shell.closeInfo(); go(0);
  }
  function startPresent() {
    if (run.mode) finish();
    if (!shell.started) shell.start(true);
    run.mode = 'present'; run.steps = [...PRESENT, ...(ctx.scenarioSlides || []), PRESENT_END].map(stepOf);
    document.body.classList.add('presenting'); shell.closeInfo(); ctx.trace.close();
    document.documentElement.requestFullscreen?.().catch(() => {});
    go(0);
    // the office slide opens its traceroute
    const o = run.steps.find(s => s.id === 'office'); if (o) { o.camera = officeView(); o.enter = () => ctx.trace.open('karachi', 'youtube'); o.leave = () => ctx.trace.close(); }
  }

  // keyboard: tour (← → Esc), presentation (← → PageUp/PageDown space Esc), P toggles presentation
  shell.keyHook = ev => {
    if (run.mode) {
      if (['ArrowRight', 'PageDown', 'Enter'].includes(ev.key) || (ev.key === ' ' && run.mode === 'present')) { ev.preventDefault(); go(run.i + 1); return true; }
      if (['ArrowLeft', 'PageUp'].includes(ev.key)) { ev.preventDefault(); if (run.i > 0) go(run.i - 1); return true; }
      if (ev.key === 'Escape') { finish(); return true; }
    }
    if ((ev.key === 'p' || ev.key === 'P') && !ev.metaKey && !ev.ctrlKey) { run.mode === 'present' ? finish() : startPresent(); return true; }
    if (ev.key === '?') { startTour(); return true; }
    return false;
  };
  addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && run.mode === 'present') finish(); });
  ui('tHelp').onclick = () => { if (!shell.started) shell.start(true); startTour(); };
  ui('tPresent').onclick = () => (run.mode === 'present' ? finish() : startPresent());
  // a click on an office during the last tour step ends the tour
  on('shell:select', n => { if (run.mode === 'tour' && run.steps[run.i]?.id === 'try' && n?.tier === 'office') finish(); });
  // Start (not "Skip intro") begins the tour
  on('shell:started', ({ skip }) => { if (!skip) startTour(); });

  void state; void VIEWS;
  return { startTour, startPresent, finish, go, get running() { return run.mode; }, get step() { return run.i; }, seen: () => store.get('paknet.tourSeen') === '1' };
}

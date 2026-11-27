// "Watch the story": a film-like player that plays the whole story by itself (Phase 4).
// Chapters: Earth → Pakistan; a YouTube video from the Karachi office to Europe and back; WhatsApp to
// Dubai; an email from Islamabad to Lahore; the satellites; then every scenario. The camera follows real
// parcels and the real routes (the same traceroute and cables you can explore), captions fade in, and
// any click pauses. Controls: play / pause, previous / next, 0.5× 1× 2×, chapter list; Esc leaves.
import { ui } from './dom.js';
import { on } from '../events.js';
import { gloss } from './glossary.js';
import { KIDS } from '../stories/kids.js';
import { flyTo, flying, pose, input } from '../render/globecam.js';
import { packetPos } from '../render/packets.js';
import { PAKSAT_VIEW } from '../render/paksat3d.js';
import { satLayers, applyLayers } from '../render/satellites.js';

const llOf = v => { const r = v.length(); return { lat: Math.asin(v.z / r) * 180 / Math.PI, lon: Math.atan2(v.y, v.x) * 180 / Math.PI }; };

export function initWatch(ctx) {
  const { G, shell, offices } = ctx;
  const showFar = () => { if (!satLayers.far) { satLayers.far = true; applyLayers(); ctx.setLayer('satellite', true); } };
  // the real route of an office's parcels: its landing station, the middle of the cable, the landing abroad
  const route = (key, dest) => {
    const t = offices.traceroute(key, dest), ce = t?.path.edges.at(-1), on = ce && ((dest === 'whatsapp' && ce.onwardGulf) || ce.onward);
    if (!on) return null;
    const cls = G.nodes[ce.a], mid = llOf(on.gpts[Math.floor(on.gpts.length / 2)]), end = llOf(on.dest.pos);
    return { cls: { lat: cls.lat, lon: cls.lon }, mid, end, dest: on.dest.name.split(',')[0], km: Math.round(on.cum.at(-1) + (ce.gcum?.at(-1) || 0)), cable: ce.cable.name };
  };
  const officeAt = k => { const o = offices.byKey[k]; return { lat: o.lat, lon: o.lon, range: 1.2, tilt: 58, heading: 25 }; };
  const follow = (key, dest, secs) => ({ run: () => { fol = { key, dest, until: secs, t: 0, b: null }; } });

  // a chapter: { title, beats: [[time s, { say, cam, fly ms, run() }]], len s } or { title, scenario }
  const story = () => {
    const yt = route('karachi', 'youtube'), wa = route('karachi', 'whatsapp');
    const ch = [
      { title: 'Earth to Pakistan', len: 21, beats: [
        [0, { cam: { lat: 20, lon: 50, range: 26000, heading: 0, tilt: 0 }, fly: 2500, say: 'This is our Earth. The thin bright lines are cables under the sea.' }],
        [7, { cam: { lat: 22, lon: 62, range: 9000, heading: 0, tilt: 8 }, fly: 5000, say: 'The internet travels through these cables, from country to country.' }],
        [14, { cam: 'pakistan', fly: 5000, say: 'This is Pakistan. Its internet links reach every big city.' }]] }
    ];
    if (yt) ch.push({ title: 'A YouTube video', len: 38, beats: [
      [0, { cam: officeAt('karachi'), fly: 4500, run: () => ctx.trace.open('karachi', 'youtube'), say: 'Someone in our Karachi office presses play on a YouTube video.' }],
      [6, { ...follow('karachi', 'youtube', 7), say: 'The request leaves in small parcels. Watch one go.' }],
      [13, { cam: { ...yt.cls, range: 25, tilt: 50, heading: 200 }, fly: 3500, say: 'The parcels reach the beach. Here the undersea cable starts.' }],
      [19, { cam: { ...yt.mid, range: 3500, tilt: 20, heading: 0 }, fly: 4500, say: `They race under the sea on ${yt.cable}, almost as fast as light.` }],
      [26, { cam: { ...yt.end, range: 600, tilt: 35, heading: 0 }, fly: 4000, say: `In ${yt.dest}, about ${yt.km.toLocaleString('en')} km away, they reach a Google server.` }],
      [32, { cam: 'pakistan', fly: 4500, say: 'The video comes back the same way. All of it takes less than a blink.' }]] });
    if (wa) ch.push({ title: 'A WhatsApp message to Dubai', len: 24, beats: [
      [0, { cam: officeAt('karachi'), fly: 4000, run: () => ctx.trace.open('karachi', 'whatsapp'), say: 'Now a WhatsApp message to a friend in Dubai.' }],
      [6, { cam: { ...wa.cls, range: 60, tilt: 45, heading: 230 }, fly: 3500, say: 'It takes the same kind of road: down to the sea first.' }],
      [12, { cam: { ...wa.end, range: 500, tilt: 35, heading: 300 }, fly: 4500, say: `The cable lands in ${wa.dest}, close to Dubai. Your friend gets the message.` }],
      [19, { cam: 'pakistan', fly: 4000 }]] });
    ch.push({ title: 'An email to Lahore', len: 24, beats: [
      [0, { cam: officeAt('islamabad'), fly: 4500, run: () => ctx.trace.open('islamabad', 'email'), say: 'An email from Islamabad to a friend in Lahore.' }],
      [6, { ...follow('islamabad', 'email', 7), say: 'It never leaves Pakistan. It runs along the motorway in a fibre cable.' }],
      [14, { cam: { lat: 32.6, lon: 73.7, range: 420, tilt: 25, heading: 0 }, fly: 4000, say: 'Companies swap parcels at exchanges like PKIX, so the email stays close to home.' }],
      [20, { cam: officeAt('lahore'), fly: 3500, say: 'Here it is in Lahore.' }]] });
    ch.push({ title: 'Satellites', len: 30, beats: [
      [0, { cam: 'far', fly: 5000, run: () => { ctx.trace.close(); showFar(); }, say: 'Far above the Earth, satellites help too.' }],
      [7, { cam: PAKSAT_VIEW, fly: 6000, say: 'This is PakSat-MM1, Pakistan’s own internet satellite.' }],
      [15, { say: 'Its big wings catch sunlight for power. Its dishes talk to the ground.' }],
      [22, { cam: { lat: 24.79, lon: 67.12, range: 0.5, tilt: 55, heading: 40 }, fly: 6500, say: 'Down here, ground stations point their dishes at it.' }]] });
    for (const id of ctx.scen.ORDER) ch.push({ title: KIDS[id]?.title || id, scenario: id });
    return ch;
  };

  const w = { on: false, playing: false, speed: 1, ci: 0, t: 0, next: 0, ch: null, endAt: null };
  let fol = null; // following a parcel: { key, dest, until, t, b }

  function say(text) { const c = ui('wcap'); if (!text) { c.classList.remove('on'); return; } c.innerHTML = `<p class="chg">${gloss(text)}</p>`; c.classList.add('on'); }
  function chapter(i) {
    w.inBeat = true; try { ctx.trace.close(); if (ctx.scen.current) ctx.scen.stop(true); } finally { w.inBeat = false; } fol = null; say('');
    w.ci = i; w.t = 0; w.next = 0; w.endAt = null; const c = w.ch[i];
    if (!c) { leave(); return; }
    if (c.scenario) { w.inBeat = true; try { ctx.scen.start(c.scenario); } finally { w.inBeat = false; } say(''); } // our own doing: not a reason to stop
    render();
  }
  function beat(b) {
    w.inBeat = true; try { if (b.run) b.run(); } finally { w.inBeat = false; }
    if (b.cam) flyTo(typeof b.cam === 'function' ? b.cam() : b.cam, (b.fly || 3000) / w.speed); // a function: where it is now (the satellite)
    if (b.say !== undefined) say(b.say);
  }
  // advance by wall seconds dt
  function tick(dt) {
    if (!w.on || !w.playing) return;
    const c = w.ch[w.ci]; if (!c) return;
    w.t += dt * w.speed;
    if (c.scenario) {
      if (w.speed > 1) ctx.scen.frame(dt * (w.speed - 1)); // the story's own clock, faster
      if (!ctx.scen.current) { chapter(w.ci + 1); return; }
      if (ctx.scen.ended) { w.endAt ??= w.t; if (w.t - w.endAt > 5) chapter(w.ci + 1); }
    } else {
      while (w.next < c.beats.length && c.beats[w.next][0] <= w.t) beat(c.beats[w.next++][1]);
      if (w.t >= c.len) { chapter(w.ci + 1); return; }
    }
    if (fol) followParcel(dt);
    const bar = ui('wProg'); if (bar) bar.style.width = `${Math.min(100, (c.scenario ? ctx.scen.t / ctx.scen.dur : w.t / c.len) * 100).toFixed(1)}%`;
  }
  // keep a real parcel of this office in the middle of the view
  function followParcel(dt) {
    fol.t += dt * w.speed; if (fol.t > fol.until) { fol = null; return; }
    // a parcel still in the city (not yet on its last, long hop), so the view stays at street level
    const city = b => b.opt.dest === fol.dest && b.visible && b.state !== 'done' && b.state !== 'dropped' && b.hop < b.edges.length - 1;
    if (!fol.b || !city(fol.b)) fol.b = offices.getFlowsFrom(fol.key).find(city) || null;
    if (!fol.b || flying() || !fol.b.path) return;
    const p = llOf(packetPos(fol.b, fol.b.d)), k = Math.min(1, dt * 2.5);
    pose.lat += (p.lat - pose.lat) * k; pose.lon += (p.lon - pose.lon) * k; pose.range += (Math.max(1.5, Math.min(40, pose.range)) - pose.range) * k;
  }

  function render() {
    const c = w.ch[w.ci];
    ui('wTitle').textContent = `${w.ci + 1} / ${w.ch.length} · ${c?.title || ''}`;
    ui('wPlay').innerHTML = `<svg class="ico2"><use href="#s-${w.playing ? 'pause' : 'play'}"/></svg>`; ui('wPlay').setAttribute('aria-label', w.playing ? 'Pause' : 'Play');
    ui('wResume').classList.toggle('on', w.on && !w.playing);
    document.querySelectorAll('#wSpeed button').forEach(b => b.classList.toggle('on', +b.dataset.s === w.speed));
    ui('wList').innerHTML = w.ch.map((x, i) => `<li><button data-c="${i}" class="${i === w.ci ? 'on' : ''}">${i + 1}. ${x.title}</button></li>`).join('');
    ui('wList').querySelectorAll('[data-c]').forEach(b => b.onclick = () => { ui('wList').classList.remove('on'); chapter(+b.dataset.c); setPlaying(true); });
  }
  function setPlaying(p) { w.playing = p; render(); }
  function start(at = 0) {
    if (ctx.tour?.running) ctx.tour.finish();
    if (!shell.started) shell.start(true);
    shell.closeInfo(); w.ch = story(); w.on = true; w.speed = w.speed || 1;
    document.body.classList.add('watching'); ui('watch').classList.add('on');
    chapter(at); setPlaying(true);
  }
  // fly = false when the viewer chose something else (Expert, a search result, a scenario): their view wins
  function leave(fly = true) {
    if (!w.on) return; w.on = false; w.playing = false; fol = null; say('');
    ctx.trace.close(); if (ctx.scen.current) ctx.scen.stop(true);
    document.body.classList.remove('watching'); ui('watch').classList.remove('on'); ui('wResume').classList.remove('on'); ui('wList').classList.remove('on');
    if (fly) flyTo('pakistan');
  }
  // one mode at a time: Expert, the tour, a chosen scenario or a picked search result end the film
  on('shell:expert', v => { if (v) leave(false); });
  on('shell:select', n => { if (n && w.on && !w.inBeat) leave(false); }); // a real pick, not a card closing

  // controls
  ui('wPlay').onclick = () => setPlaying(!w.playing);
  ui('wResume').onclick = () => setPlaying(true);
  ui('wPrev').onclick = () => { chapter(Math.max(0, w.t > 3 ? w.ci : w.ci - 1)); setPlaying(true); };
  ui('wNext').onclick = () => { chapter(w.ci + 1); setPlaying(true); };
  ui('wChapters').onclick = () => ui('wList').classList.toggle('on');
  ui('wExit').onclick = leave;
  document.querySelectorAll('#wSpeed button').forEach(b => b.onclick = () => { w.speed = +b.dataset.s; render(); });
  // any click or drag on the globe pauses (and shows Resume)
  const prev = input.onInteract; input.onInteract = () => { prev?.(); if (w.on && w.playing) setPlaying(false); };

  return { start, leave, tick, get on() { return w.on; }, get playing() { return w.playing; }, get chapter() { return w.ci; }, get chapters() { return w.ch?.length || 0; },
    setSpeed: s => { w.speed = s; render(); }, key: ev => {
      if (!w.on) return false;
      if (ev.key === 'Escape') { leave(); return true; }
      if (ev.key === ' ') { ev.preventDefault(); setPlaying(!w.playing); return true; }
      if (ev.key === 'ArrowRight') { chapter(w.ci + 1); setPlaying(true); return true; }
      if (ev.key === 'ArrowLeft') { chapter(Math.max(0, w.ci - 1)); setPlaying(true); return true; }
      return true; // the player owns the keyboard while it plays
    } };
}

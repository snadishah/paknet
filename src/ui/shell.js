// The layman shell (docs/REDESIGN.md §7): first screen, time bar, search,
// info card, layers menu, lighting toggle, Expert drawer, deep links, credits
// and the credits line. The original panels keep working inside Expert mode.
// No stats are ever shown on screen; ?perf=1 only logs a short line to the browser console.
import { state } from '../state.js';
import { emit, on } from '../events.js';
import { subSolarPoint, flatToLatLon } from '../geo/globe.js';
import { ui } from './dom.js';
import { tierName, mediumName } from './route.js';
import { flyTo, pose, spin, input, setPose, keyNav, altitudeKm } from '../render/globecam.js';
import { setSun, setFlood, globeUniforms } from '../render/globe.js';
import { layers, renderer, sunLight, netRoot } from '../render/scene.js';
import { tileState } from '../render/tiles.js';
import { cityBusy } from '../render/city.js';
import { busyLabel } from '../busy.js';
import { initFades, patchHtml } from './fades.js';
import { labelState } from '../render/labels.js';
import { gloss } from './glossary.js';
import { fadeIn } from '../render/fade3d.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PKT = 5; // Pakistan Standard Time = UTC+5

// ---------- the clock: simulated date, rate, LIVE ----------
export const clock = { t: Date.now(), rate: 1, live: true };
function setRate(r) { clock.rate = r; if (r !== 1) setLive(false); document.querySelectorAll('#timebar [data-rate]').forEach(b => b.classList.toggle('on', +b.dataset.rate === r)); writeHash(); }
function setLive(v) { clock.live = v; if (v) { clock.t = Date.now(); clock.rate = 1; document.querySelectorAll('#timebar [data-rate]').forEach(b => b.classList.toggle('on', b.dataset.rate === '1')); } ui('tbLive').classList.toggle('on', v); }
const pktHour = t => (((t / 3600000 + PKT) % 24) + 24) % 24;
const fmt = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

export function initShell(ctx) {
  const { G, view, net } = ctx;
  const body = document.body, params = new URLSearchParams(location.search);
  initFades(); // panels and cards fade in and out
  const sh = { started: false, expert: false, selected: null, searchEntries: [] };
  const perfLog = params.has('perf'); // developer check: console only, never on screen
  const verifyRun = params.has('verify');

  // ---------- first screen ----------
  spin.on = !matchMedia('(prefers-reduced-motion: reduce)').matches; // the slow intro spin, unless motion is reduced
  labelState.enabled = false; netRoot.visible = false;
  function start(skip = false) {
    if (sh.started) return; sh.started = true; spin.on = false;
    ui('intro').classList.add('gone'); setTimeout(() => ui('intro').style.display = 'none', 650);
    body.classList.add('started'); labelState.enabled = true; netRoot.visible = true; fadeIn(netRoot, 800); // the network fades in
    if (skip) flyTo('pakistan', 1600); // a short flight, never a jump (Start: the tour, ui/tour.js, takes the camera from here)
    emit('shell:started', { skip });

  }
  ui('btnStart').onclick = () => start(false);
  ui('btnSkip').onclick = () => start(true);
  sh.start = start;

  // ---------- hint line ----------
  let hintT = 0;
  function hint(text, ms = 4000) { const h = ui('hint'); clearTimeout(hintT); if (!text) { h.classList.remove('on'); return; } h.textContent = text; h.classList.add('on'); hintT = setTimeout(() => h.classList.remove('on'), ms); }
  sh.hint = hint;

  // ---------- time bar ----------
  ui('tbPlay').onclick = () => setPlaying(!state.playing);
  function setPlaying(p) { state.playing = p; ui('tbPlay').innerHTML = `<svg class="ico2"><use href="#s-${p ? 'pause' : 'play'}"/></svg>`; ui('tbPlay').setAttribute('aria-label', p ? 'Pause' : 'Play'); ui('play')?.classList.toggle('paused', !p); }
  sh.setPlaying = setPlaying;
  document.querySelectorAll('#timebar [data-rate]').forEach(b => b.onclick = () => setRate(+b.dataset.rate));
  ui('tbLive').onclick = () => { setLive(true); writeHash(); };
  sh.setRate = setRate; sh.setLive = setLive;

  // ---------- lighting ----------
  let flood = false;
  ui('tLight').onclick = () => { flood = !flood; setFlood(flood); sunLight.intensity = flood ? 1.2 : 2.2; ui('tLightLbl').textContent = flood ? 'Flood' : 'Natural'; ui('tLight').setAttribute('aria-label', 'Lighting: ' + (flood ? 'flood (everything lit)' : 'natural (real sun)')); ui('tLight').classList.toggle('on', flood); writeHash(); };
  sh.setFloodLight = v => { if (v !== flood) ui('tLight').click(); };

  // ---------- Expert drawer ----------
  function setExpert(v) {
    sh.expert = v; body.classList.toggle('expert', v); ui('tExpert').classList.toggle('on', v); ui('tExpert').setAttribute('aria-pressed', v);
    emit('shell:expert', v); if (sh.selected) showNode(sh.selected, false);
  }
  ui('tExpert').onclick = () => setExpert(!sh.expert);
  sh.setExpert = setExpert;
  ui('btnAbout2').onclick = () => ui('btnAbout')?.click();

  // ---------- layers menu ----------
  // [label, explanation, layer keys] — the scene layers are the original ones (panel.js setLayer)
  sh.layerItems = [
    ['The network', 'Cables, fibre roads and routers', ['backbone', 'cables', 'routers', 'gateways']],
    ['Province borders', 'Thin lines between provinces', ['borders']],
    ['All towns', 'Every town as a small dot', ['cities']],
    ['Microwave towers (north)', 'Backup radio link to China', ['microwave']],
    ['Planned links', 'Gwadar cable and CPEC fibre (not built)', ['planned']],
    ['Labels', 'Names of places', ['labels']]
  ];
  const extraToggles = [['Satellite photos up close', 'Real photos of the ground when you zoom in', () => tileState.enabled, v => { tileState.enabled = v; }]];
  sh.extraToggles = extraToggles;
  function renderLayers() {
    const m = ui('menuLayers');
    m.innerHTML = '<h6>Show on the map</h6>' + sh.layerItems.map(([t, d, ks], i) => `<label><input type="checkbox" data-li="${i}" ${ks.every(k => k === 'labels' ? labelState.enabled : layers[k]?.visible) ? 'checked' : ''}><span>${esc(t)}<small>${esc(d)}</small></span></label>`).join('')
      + extraToggles.map(([t, d, get], i) => `<label><input type="checkbox" data-xi="${i}" ${get() ? 'checked' : ''}><span>${esc(t)}<small>${esc(d)}</small></span></label>`).join('')
      + (sh.satToggles?.length ? '<h6>Satellites</h6>' + sh.satToggles.map(([t, d, get], i) => `<label><input type="checkbox" data-si="${i}" ${get() ? 'checked' : ''}><span>${esc(t)}<small>${esc(d)}</small></span></label>`).join('') : '');
    m.querySelectorAll('[data-li]').forEach(i => i.onchange = () => { for (const k of sh.layerItems[+i.dataset.li][2]) { if (k === 'labels') labelState.enabled = i.checked; else ctx.setLayer(k, i.checked); } });
    m.querySelectorAll('[data-xi]').forEach(i => i.onchange = () => extraToggles[+i.dataset.xi][3](i.checked));
    m.querySelectorAll('[data-si]').forEach(i => i.onchange = () => sh.satToggles[+i.dataset.si][3](i.checked));
  }
  sh.renderLayers = renderLayers;
  ui('tLayers').onclick = ev => { ev.stopPropagation(); const m = ui('menuLayers'); const o = !m.classList.contains('on'); if (o) renderLayers(); m.classList.toggle('on', o); ui('tLayers').classList.toggle('on', o); ui('tLayers').setAttribute('aria-expanded', o); };
  document.addEventListener('click', ev => { if (!ev.target.closest('#menuLayers') && !ev.target.closest('#tLayers')) { ui('menuLayers').classList.remove('on'); ui('tLayers').classList.remove('on'); } });

  // ---------- info card ----------
  // info: { kick, title, tags: [[text, cls]], what, why, showMe: fn, expert: () => [[k, v]] , extraHtml }
  let expertFn = null;
  // plain text gets glossary tooltips; text that is already HTML is used as is
  const fmtText = t => (/[<&]/.test(t) ? t : gloss(t));
  function showInfo(info) {
    const c = ui('infocard'); expertFn = info.expert || null;
    patchHtml(c, `<button class="sbtn x" id="icX" aria-label="Close"><svg class="ico2"><use href="#s-close"/></svg></button>
      ${info.kick ? `<p class="kick">${esc(info.kick)}</p>` : ''}<h3>${esc(info.title)}</h3>
      ${(info.tags || []).map(([t, cl]) => `<span class="tag ${cl || ''}">${esc(t)}</span>`).join('')}
      ${info.what ? `<p><b>What it is:</b> ${fmtText(info.what)}</p>` : ''}${info.why ? `<p class="why"><b>Why it matters:</b> ${fmtText(info.why)}</p>` : ''}
      ${info.extraHtml || ''}
      <div class="row">${info.showMe ? '<button class="chipbtn" id="icShow">Show me</button>' : ''}${(info.buttons || []).map((b, i) => `<button class="chipbtn ghost" data-ib="${i}">${esc(b[0])}</button>`).join('')}</div>
      ${expertFn ? `<details id="icExp" ${sh.expert ? 'open' : ''}><summary>Expert details</summary><dl id="icDl"></dl></details>` : ''}`);
    c.classList.add('on');
    ui('icX').onclick = closeInfo;
    if (info.showMe) ui('icShow').onclick = info.showMe;
    c.querySelectorAll('[data-ib]').forEach(b => b.onclick = info.buttons[+b.dataset.ib][1]);
    refreshExpert();
  }
  function refreshExpert() { const dl = ui('icDl'); if (!dl || !expertFn) return; dl.innerHTML = expertFn().map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join(''); }
  function closeInfo() { ui('infocard').classList.remove('on'); sh.selected = null; expertFn = null; emit('shell:select', null); }
  sh.showInfo = showInfo; sh.closeInfo = closeInfo; sh.refreshExpert = refreshExpert;

  // Plain-English descriptions of every kind of place in the network.
  const WHAT = {
    core: ['A big city where many internet roads meet.', 'Its main routers work like a central post office: if it has trouble, traffic between nearby cities must take a longer road.'],
    agg: ['A city router that collects traffic from the towns around it.', 'It hands that traffic to the big roads between cities.'],
    access: ['A town. Homes and phones here connect through the nearest bigger city.', 'Most people reach the internet through towns like this.'],
    cls: ['A cable landing station: where an undersea internet cable comes out of the sea.', "All of Pakistan's undersea cables land around Karachi, so trouble here is felt across the whole country."],
    ixp: ['An internet exchange: a meeting place where internet companies swap traffic directly.', 'It keeps traffic between two Pakistani networks inside Pakistan, which is faster and cheaper.'],
    dc: ['A data centre: a building full of computers that keeps copies of popular videos and sites.', "Videos start faster because they don't have to cross the sea."],
    intl: ['Where cables leave this map, heading to other countries.', 'Most websites people use are hosted abroad, so most traffic travels this way.'],
    gw: ['A satellite ground station: a big dish that talks to PakSat-MM1 in space.', 'It connects places with no cables, and is a backup if cables fail.'],
    vsat: ['A small satellite dish for a remote town far from cables.', "Without it, this town might have no internet at all."],
    tower: ['A microwave relay tower on the mountain road to China.', 'Each tower beams the signal to the next one, a backup for the fibre cable.'],
    sat: ["PakSat-MM1, Pakistan's own communication satellite.", 'It hangs still above the equator and links remote places and ground stations.']
  };
  const RANGE = { core: 160, agg: 90, access: 40, cls: 6, ixp: 4, dc: 4, intl: 1400, gw: 8, vsat: 30, tower: 30, sat: 52000 };
  function nodeLatLon(n) { if (n.lat != null && n.tier !== 'sat') return { lat: n.lat, lon: n.lon }; const ll = flatToLatLon(n.pos.x, n.pos.y); return ll; }
  sh.nodeLatLon = nodeLatLon;
  function showNode(n, fly = false) {
    if (!n) return; sh.selected = n; emit('shell:select', n);
    if (n.describe) { showInfo(n.describe(sh)); return; }
    const [what, why] = WHAT[n.tier] || ['A part of the network.', ''];
    const ll = nodeLatLon(n);
    const showMe = () => n.tier === 'sat' ? flyTo('far') : flyTo({ lat: ll.lat, lon: ll.lon, range: RANGE[n.tier] || 200, tilt: n.tier === 'core' ? 35 : 25, heading: 0 });
    const tags = []; if (n.planned) tags.push(['Planned, not built']); if (n.note && /unverified|illustrative/i.test(n.note)) tags.push(['Unverified', 'grey']);
    if (['core', 'agg', 'access'].includes(n.tier) || n.kind === 'tower') tags.push(['Network inside Pakistan is illustrative', 'grey']);
    showInfo({
      kick: tierName(n), title: n.name, what, why, tags, showMe,
      expert: () => {
        const links = G.adj.get(n.id).filter(e => e.type !== 'access' || n.tier === 'access');
        const rows = [['Node id', `#${n.id} (${n.tier})`]];
        if (n.pop) rows.push(['Population', n.pop.toLocaleString()]);
        if (n.op) rows.push(['Operator', n.op]);
        rows.push(['Links', links.length]);
        const q = ctx.lastSample?.nodeQ?.get(n.id); if (q != null) rows.push(['Fullest queue', (q * 100).toFixed(0) + '%']);
        links.slice(0, 6).forEach(e => { const o = G.nodes[e.a === n.id ? e.b : e.a]; rows.push([`→ ${o.name}`, `${mediumName(e)}, ${!net.usable(e) ? 'down' : ((e.util || 0) * 100).toFixed(0) + '% busy'}`]); });
        if (n.note) rows.push(['Note', n.note]);
        return rows;
      }
    });
    if (fly) showMe();
  }
  sh.showNode = showNode;
  function showCable(c, fly = false) {
    const st = c.status === 'live' ? (c.stat || 'In service') : c.stat || (c.status === 'retired' ? 'Retired' : 'Landed, not in service');
    const mid = c.edges[0].gpts[Math.floor(c.edges[0].gpts.length * 0.5)];
    const showMe = () => { const r = Math.hypot(mid.x, mid.y, mid.z); flyTo({ lat: Math.asin(mid.z / r) * 180 / Math.PI, lon: Math.atan2(mid.y, mid.x) * 180 / Math.PI, range: 1600, tilt: 20 }); };
    sh.selected = { cable: c }; emit('shell:select', { cable: c });
    showInfo({
      kick: 'Undersea cable', title: c.name, tags: [[st, c.status === 'live' ? 'live' : 'grey'], ['Route beyond the map is illustrative', 'grey']],
      what: 'A cable on the sea floor, thinner than a garden hose inside, carrying light signals between countries.',
      why: `${esc(c.op)} uses it to carry Pakistan's traffic to the rest of the world. Every one of these cables comes ashore near Karachi.`,
      showMe, expert: () => [['Operator', c.op], ['Status', c.status], ['Directions', c.dirs.join(', ')], ['Share of PK traffic (model)', (c.share * 100).toFixed(0) + '%'], ['Busiest direction now', ((Math.max(0, ...c.edges.map(e => e.util || 0))) * 100).toFixed(0) + '%'], ...(c.note ? [['Note', c.note]] : [])]
    });
    if (fly) showMe();
  }
  sh.showCable = showCable;

  // click on the map (a short click, not a drag)
  let down = null;
  renderer.domElement.addEventListener('pointerdown', ev => { down = [ev.clientX, ev.clientY]; });
  renderer.domElement.addEventListener('pointerup', ev => {
    if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 5 || !sh.started) return;
    const hit = sh.pickExtra?.(ev.clientX, ev.clientY) || view.pick(ev.clientX, ev.clientY);
    if (hit?.describe || hit?.tier) showNode(hit); else if (hit?.onPick) hit.onPick(); else if (!sh.expert) closeInfo();
  });
  labelState.onClick = n => showNode(n);

  // ---------- search ----------
  const entries = sh.searchEntries;
  function addSearch(e) { entries.push(e); }
  sh.addSearch = addSearch;
  for (const n of G.nodes) {
    if (n.tier === 'core' || (n.tier === 'agg' && n.pop > 100000)) addSearch({ name: n.name, sub: 'City', go: () => showNode(n, true) });
    else if (['cls', 'ixp', 'dc', 'gw'].includes(n.tier)) addSearch({ name: n.name, sub: tierName(n), go: () => showNode(n, true) });
  }
  for (const c of G.CABLES) addSearch({ name: c.name, alt: c.id.replace(/(\D)(\d)/, '$1-$2'), sub: 'Undersea cable', go: () => showCable(c, true) });
  addSearch({ name: 'Pakistan', sub: 'Country', go: () => flyTo('pakistan') });
  addSearch({ name: 'Earth', sub: 'View from space', go: () => flyTo('space') });
  addSearch({ name: 'Red Sea', sub: 'Where several cables were cut', go: () => flyTo('redsea') });
  const input_ = ui('searchInput'), list = ui('searchList'); let results = [], sel = 0;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  function runSearch() {
    const q = norm(input_.value); if (!q) { list.classList.remove('on'); results = []; return; }
    const score = e => { const a = norm(e.name), b = norm(e.alt || ''); return a.startsWith(q) || b.startsWith(q) ? 0 : a.includes(q) || b.includes(q) ? 1 : norm(e.sub).includes(q) ? 2 : 9; };
    results = entries.map(e => [score(e), e]).filter(x => x[0] < 9).sort((a, b) => a[0] - b[0] || a[1].name.length - b[1].name.length).slice(0, 8).map(x => x[1]);
    sel = 0; list.innerHTML = results.length ? results.map((e, i) => `<li role="option" data-i="${i}" class="${i === sel ? 'sel' : ''}">${esc(e.name)}<small>${esc(e.sub)}</small></li>`).join('') : '<li class="muted">Nothing found</li>';
    list.classList.add('on'); list.querySelectorAll('[data-i]').forEach(li => li.onclick = () => pickResult(+li.dataset.i));
  }
  function pickResult(i) { const e = results[i]; if (!e) return; input_.value = ''; list.classList.remove('on'); input_.blur(); if (!sh.started) start(true); e.go(); }
  input_.addEventListener('input', runSearch);
  input_.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); sel = (sel + (ev.key === 'ArrowDown' ? 1 : -1) + results.length) % Math.max(1, results.length); list.querySelectorAll('[data-i]').forEach(li => li.classList.toggle('sel', +li.dataset.i === sel)); }
    else if (ev.key === 'Enter') pickResult(sel);
    else if (ev.key === 'Escape') { input_.value = ''; list.classList.remove('on'); input_.blur(); }
  });
  sh.search = (q) => { input_.value = q; runSearch(); return results.map(r => r.name); };
  sh.searchGo = (q) => { sh.search(q); pickResult(0); };

  // ---------- keyboard ----------
  addEventListener('keydown', ev => {
    if (ev.target.closest?.('input, textarea, select')) return;
    if (sh.keyHook?.(ev)) return; // tour / presentation keys first (Esc leaves them, Space steps slides)
    if (ev.key === '/' ) { ev.preventDefault(); if (!sh.started) start(true); input_.focus(); return; }
    if (ev.key === 'Escape') { closeInfo(); ui('menuLayers').classList.remove('on'); return; }
    if (ev.key === ' ' && sh.started && !ev.target.closest('button')) { ev.preventDefault(); setPlaying(!state.playing); return; }
    if (sh.started && keyNav(ev)) ev.preventDefault();
  });
  input.onInteract = () => { if (!sh.started) start(true); };

  // ---------- deep links: #v=lat,lon,range,heading,tilt&f=focus&t=ISO&r=rate&l=flood&x=expert ----------
  let lastHash = '';
  function writeHash() {
    if (!sh.started) return;
    const h = new URLSearchParams();
    h.set('v', [pose.lat.toFixed(3), pose.lon.toFixed(3), pose.range.toPrecision(4), pose.heading.toFixed(0), pose.tilt.toFixed(0)].join(','));
    if (sh.selected?.name) h.set('f', sh.selected.name); else if (sh.selected?.cable) h.set('f', sh.selected.cable.name);
    if (!clock.live) h.set('t', new Date(clock.t).toISOString().slice(0, 16)); if (clock.rate !== 1) h.set('r', clock.rate);
    if (flood) h.set('l', 'flood'); if (sh.expert) h.set('x', '1');
    const s = '#' + h.toString().replace(/%2C/g, ','); if (s !== location.hash) { history.replaceState(null, '', s); } lastHash = location.hash;
  }
  sh.writeHash = writeHash;
  function readHash() {
    if (!location.hash) return false;
    const h = new URLSearchParams(location.hash.slice(1)); if (!h.has('v') && !h.has('f')) return false;
    start(true);
    const v = (h.get('v') || '').split(',').map(Number); if (v.length === 5 && v.every(Number.isFinite)) flyTo({ lat: v[0], lon: v[1], range: v[2], heading: v[3], tilt: v[4] }, 2200); // a link flies in
    if (h.get('t')) { const t = Date.parse(h.get('t') + 'Z'); if (Number.isFinite(t)) { setLive(false); clock.t = t; } }
    if (h.get('r')) setRate(+h.get('r'));
    sh.setFloodLight(h.get('l') === 'flood');
    if (h.get('x') === '1') setExpert(true);
    const f = h.get('f'); if (f) { const e = entries.find(e => e.name === f); if (e) setTimeout(() => { const keep = { ...pose }; e.go(); setPose(keep); }, 0); }
    return true;
  }
  sh.readHash = readHash;
  on('view:changed', () => setTimeout(writeHash, 3200));
  // pasting a bookmarked link into the address bar of an open page
  addEventListener('hashchange', () => { if (location.hash !== lastHash) readHash(); });
  let hashT = 0;

  // ---------- per frame ----------
  let lastCredit = '';
  // the loading indicator: on after 250 ms of loading (no flicker for quick loads), off 600 ms after the last item arrives
  let busySince = 0, idleSince = 0, busyText = '';
  const showBusy = label => {
    const now = performance.now(), el = ui('busy'); if (!el) return;
    if (label) { busySince ||= now; idleSince = 0; if (label !== busyText) { busyText = label; el.querySelector('.txt').textContent = label; el.setAttribute('aria-label', label); } }
    else { busySince = 0; idleSince ||= now; }
    el.classList.toggle('on', label ? now - busySince > 250 : el.classList.contains('on') && now - idleSince < 600);
  };
  const creditHtml = () => {
    const p = tileState.provider;
    if (p === 'esri') return ` · <span class="esri">Powered by <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a></span> · Imagery: ${esc(tileState.credit)}${tileState.labels === 'provider' && tileState.labelsCredit ? ` · Labels: ${esc(tileState.labelsCredit)}` : ''}`;
    if (p === 'eox') return ' · Sentinel-2 cloudless - <a href="https://s2maps.eu" target="_blank" rel="noopener">https://s2maps.eu</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data)';
    if (p) return ` · ${esc(tileState.credit)}`;
    return '';
  };
  let pf = { n: 0, t: performance.now(), ms: 0 }; const stats = window.__paknetStats = { calls: 0, maxCalls: 0, triangles: 0, textures: 0, geometries: 0 };
  sh.frame = (dt, rawMs) => {
    if (state.playing) { clock.t += dt * 1000 * clock.rate; if (clock.live && Math.abs(clock.t - Date.now()) > 2000) clock.t = Date.now(); }
    state.simHour = pktHour(clock.t);
    const ss = subSolarPoint(new Date(clock.t)); setSun(ss.lat, ss.lon);
    sunLight.position.copy(globeUniforms.uSun.value).multiplyScalar(100000);
    ui('tbClock').innerHTML = `${fmt(state.simHour)}<small>${clock.live ? 'Pakistan time · now' : new Date(clock.t + PKT * 3600000).toISOString().slice(0, 10)}</small>`;
    body.classList.toggle('tiles-on', tileState.active && tileState.loaded > 0 && (tileState.fade || 0) > 0.02);
    // the credits of whichever imagery is on screen (Esri: "Powered by Esri" + the text the service returns)
    const ck = `${tileState.provider}|${tileState.credit}|${tileState.labels}|${tileState.labelsCredit}`;
    if (ck !== lastCredit) { lastCredit = ck; ui('creditTiles').innerHTML = creditHtml(); }
    showBusy(tileState.busy ? 'Loading satellite photos' : cityBusy() ? 'Loading buildings' : busyLabel());
    if (performance.now() - hashT > 1000) { hashT = performance.now(); writeHash(); if (expertFn && ui('icExp')?.open) refreshExpert(); }
    const inf = renderer.info; stats.calls = inf.render.calls; stats.triangles = inf.render.triangles; stats.textures = inf.memory.textures; stats.geometries = inf.memory.geometries;
    if (sh.started && stats.calls > stats.maxCalls) {
      stats.maxCalls = stats.calls; stats.maxAt = `${Math.round(altitudeKm)} km · ${body.className}`; // where the peak happened (verify)
    }
    pf.n++; pf.ms = pf.ms * 0.9 + rawMs * 0.1;
    if (perfLog && performance.now() - pf.t > 2000) { console.info(`[paknet] ${(pf.n * 1000 / (performance.now() - pf.t)).toFixed(0)} fps, ${pf.ms.toFixed(1)} ms/frame, ${stats.calls} draw calls`); pf.n = 0; pf.t = performance.now(); }
  };
  return sh;
}

function poseOf(k) { return { pakistan: { lat: 29.2, lon: 69.4, range: 2700, heading: 0, tilt: 18 } }[k]; }

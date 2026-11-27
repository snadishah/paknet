// Offices and the visual traceroute (docs/REDESIGN.md Phase 3).
// Click an office → its card; "Follow its traffic" → a numbered list of hops
// (plain names, one-line jobs, delay measured in the simulator right now). Each
// hop is clickable (the camera flies there). The hops are the routing module's
// path (sim/offices.js traceroute), so cutting a cable changes them live.
import { ui } from './dom.js';
import { gloss } from './glossary.js';
import { DESTS } from '../sim/offices.js';
import { mediumName } from './route.js';
import { flyTo } from '../render/globecam.js';
import { fromLatLon } from '../render/geo3.js';
import { highlightPath, clearHighlight, hasHighlight } from '../render/fx.js';
import { setHighlightOffice } from '../render/packets.js';
import { addLabel, removeLabel } from '../render/labels.js';

import { layers, fatLine, disposeLine } from '../render/scene.js';
import { cityState } from '../render/city.js';
import { patchHtml } from './fades.js';
import { fadeIn, fadeOut } from '../render/fade3d.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtMs = ms => (ms < 1 ? ms.toFixed(2) : ms < 10 ? ms.toFixed(1) : Math.round(ms)) + ' ms';
const EXPLAIN = {
  youtube: 'A video comes from far away: the parcels leave Pakistan on an undersea cable to a Google server (illustrative location).',
  whatsapp: "Your message goes to WhatsApp's computers abroad, then on to your friend in Dubai. It crosses the sea too.",
  email: 'Both offices are in Pakistan, so the parcels meet at an internet exchange and never leave the country.'
};

export function initTraceroute(ctx) {
  const { G, offices, shell } = ctx;
  const tr = { key: null, dest: 'youtube', pathKey: '', onward: null, farLabel: null, timer: 0 };

  // ---------- plain-English hop names ----------
  function hopInfo(h, i, t) {
    const n = h.node;
    if (i === 0) return [`Your office in ${n.parent.name}`, 'A computer here sends the message.'];
    if (n.tier === 'office') return [`Your friend's office in ${n.parent.name}`, 'The email arrives.'];
    if (i === 1) return [`Your office's internet company (${n.name})`, "Its router collects the office's parcels and sends them on."];
    switch (n.tier) {
      case 'core': return [`City post office: ${n.name}`, 'A big router that chooses the next road.'];
      case 'agg': return [`Town router: ${n.name}`, 'Passes the parcels along the highway.'];
      case 'access': return [`Town: ${n.name}`, 'A small stop on the way.'];
      case 'cls': return ['Cable landing station', 'From here the parcels go under the sea.'];
      case 'ixp': return [`Internet exchange (${n.name})`, 'Networks swap parcels here, so they stay in Pakistan.'];
      case 'dc': return [n.name, 'A building full of computers.'];
      case 'tower': return ['Mountain radio tower', 'Beams the parcels to the next tower.'];
      case 'intl': return [t.cable ? `Across the sea on ${t.cable.name}` : `Across the border: ${n.name}`, 'The parcels reach another country.'];
      default: return [n.name, ''];
    }
  }
  const slug = n => n.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 22);

  // ---------- the panel ----------
  function render() {
    const t = offices.traceroute(tr.key, tr.dest); if (!t) return;
    const key = t.path.edges.map(e => e.id).join(',');
    const changed = tr.pathKey && key !== tr.pathKey;
    if (key !== tr.pathKey || !hasHighlight()) { tr.pathKey = key; drawRoute(t); } // a cut elsewhere clears the highlight
    const expert = document.body.classList.contains('expert');
    // remember which button had keyboard focus, so the 1 s refresh doesn't take it away
    const fa = document.activeElement, focusSel = fa?.closest?.('#trace') ? (fa.dataset.hop != null ? `[data-hop="${fa.dataset.hop}"]` : fa.dataset.dest ? `[data-dest="${fa.dataset.dest}"]` : fa.id ? '#' + fa.id : null) : null;
    const rows = t.hops.map((h, i) => {
      const [name, job] = hopInfo(h, i, t);
      const how = h.edge ? `by ${mediumName(h.edge)}` : '';
      const ex = expert && h.edge ? `<small class="ex">${esc(slug(h.node))}.pk · #${h.node.id} · queue ${(h.queue * 100).toFixed(0)}% · link load ${(h.load * 100).toFixed(0)}%</small>` : '';
      return `<li><button data-hop="${i}"><span class="n">${i + 1}</span><span class="t"><b>${esc(name)}</b><small>${esc(job)}${how ? ' · ' + esc(how) : ''}</small>${ex}</span><span class="d">${i ? '+' + fmtMs(h.ms) : ''}</span></button></li>`;
    });
    const last = t.hops.at(-1);
    // past the simulator's sea point the parcels ride the same cable to its landing abroad: light in glass covers ~1 km every 5 µs
    const ce = t.path.edges.at(-1), on = t.cable && ((tr.dest === 'whatsapp' && ce?.onwardGulf) || ce?.onward), onKm = on ? on.cum.at(-1) : 0, onMs = onKm * 0.005;
    if (t.far) rows.push(`<li><button data-far="1"><span class="n">${t.hops.length + 1}</span><span class="t"><b>${esc(t.far)}</b><small>${on ? `Along the same cable to ${esc(on.dest.name)} (${Math.round(onKm).toLocaleString('en')} km), then the server answers. Estimated, not simulated.` : 'Beyond our map: the server answers. Not simulated.'}</small></span><span class="d">${on ? `+≈${fmtMs(onMs)}` : '?'}</span></button></li>`);
    const total = last.cum, measured = t.measuredMs;
    patchHtml(ui('trace'), `<div class="th"><div><p class="kick">Following parcels from</p><h3>${esc(t.office.name)}</h3><span class="tag grey">Illustrative office</span></div><button class="sbtn x" id="trX" aria-label="Close"><svg class="ico2"><use href="#s-close"/></svg></button></div>
      <div class="dests" role="group" aria-label="What is the office sending?">${Object.entries(DESTS).map(([k, d]) => `<button class="chipbtn ${k === tr.dest ? '' : 'ghost'}" data-dest="${k}" aria-pressed="${k === tr.dest}">${esc(t.office.key === 'lahore' && k === 'email' ? 'Email to a friend in Karachi' : d.label)}</button>`).join('')}</div>
      <p class="why">${gloss(t.office.key === 'lahore' && tr.dest === 'email' ? EXPLAIN.email : EXPLAIN[tr.dest])}</p>
      ${changed ? '<p class="alert">The road just changed: a link on the old road is down, so the routers picked another one.</p>' : ''}
      ${t.fate !== 'ok' ? '<p class="alert">The parcels cannot get through right now: the routers have no working road yet.</p>' : ''}
      <ol class="trhops">${rows.join('')}</ol>
      <p class="sum">Time to get there: <b>${fmtMs(total + onMs)}</b> one way${on ? ` (${fmtMs(total)} measured on each link right now, plus about ${fmtMs(onMs)} along the cable to ${esc(on.dest.name)})` : ', measured on each link right now'}${measured != null ? `; parcels took ${fmtMs(measured)} on average${on ? ' to reach that point at sea' : ''}` : ''}. A blink takes about 100 ms.</p>`);
    ui('trace').classList.add('on'); document.body.classList.add('tracing');
    if (focusSel) ui('trace').querySelector(focusSel)?.focus({ preventScroll: true });
    ui('trX').onclick = close;
    ui('trace').querySelectorAll('[data-dest]').forEach(b => b.onclick = () => { tr.dest = b.dataset.dest; tr.pathKey = ''; render(); });
    ui('trace').querySelectorAll('[data-hop]').forEach(b => b.onclick = () => goHop(t.hops[+b.dataset.hop], +b.dataset.hop));
    const far = ui('trace').querySelector('[data-far]'); if (far) far.onclick = () => { if (tr.onward) flyTo({ ...llOf(tr.onward.end), range: 2500, tilt: 20 }); };
  }
  const llOf = v => { const r = v.length(); return { lat: Math.asin(v.z / r) * 180 / Math.PI, lon: Math.atan2(v.y, v.x) * 180 / Math.PI }; };
  function goHop(h, i) {
    const n = h.node, ll = shell.nodeLatLon(n);
    const range = i === 0 || n.tier === 'office' ? 1.2 : n.tier === 'cls' || n.tier === 'ixp' ? 6 : n.tier === 'intl' ? 900 : 60;
    flyTo({ lat: ll.lat, lon: ll.lon, range, tilt: range < 10 ? 55 : 35, heading: 20 });
  }

  // route on the map: the simulated path, then the same cable on to its landing abroad (one continuous line)
  function drawRoute(t) {
    highlightPath(t.path.seq[0], t.path.edges);
    if (tr.onward) { const l = tr.onward.line; fadeOut(l, 300, () => { layers.fx.remove(l); disposeLine(l); }); tr.onward = null; }
    if (tr.farLabel) { removeLabel(tr.farLabel); tr.farLabel = null; }
    const ce = t.path.edges.at(-1);
    const o = t.cable && ((tr.dest === 'whatsapp' && ce?.onwardGulf) || ce?.onward);
    if (o) {
      const line = fatLine(o.gpts, { color: 0xf0a35b, linewidth: 2.4, opacity: 0.9 }); // same style as the highlighted route it continues
      line.renderOrder = 7; layers.fx.add(fadeIn(line)); tr.onward = { line, end: o.dest.pos };
      tr.farLabel = addLabel(`${t.far.split(' — ')[0]} · via ${o.dest.name}`, o.dest.pos, { cls: 'office', minR: 300, maxR: 40000, prio: 0, key: 'trace:far' });
    }
  }

  function open(key, dest = tr.dest) {
    tr.key = key; tr.dest = dest; tr.pathKey = ''; setHighlightOffice(key); shell.closeInfo();
    render(); clearInterval(tr.timer); tr.timer = setInterval(() => { if (tr.key) render(); }, 1000);
  }
  function close() {
    tr.key = null; clearInterval(tr.timer); setHighlightOffice(null); clearHighlight();
    if (tr.onward) { const l = tr.onward.line; fadeOut(l, 300, () => { layers.fx.remove(l); disposeLine(l); }); tr.onward = null; }
    if (tr.farLabel) { removeLabel(tr.farLabel); tr.farLabel = null; }
    ui('trace').classList.remove('on'); document.body.classList.remove('tracing');
  }

  // ---------- office cards, labels and search ----------
  const goInside = o => flyTo({ lat: o.lat, lon: o.lon, range: 1.1, tilt: 58, heading: 25 }, 3000);
  for (const o of offices.OFFICES) {
    o.describe = () => ({
      kick: 'Illustrative office', title: o.name, tags: [['Made up for teaching', 'grey']],
      what: `A pretend office in ${o.parent.name} with computers and phones. Its parcels are real traffic in the simulator.`,
      why: 'Follow its traffic to see every stop a message makes, like a parcel moving from post office to post office.',
      showMe: () => goInside(o),
      buttons: [['Follow its traffic', () => { goInside(o); open(o.key); }]],
      expert: () => [['Node id', `#${o.id} (host)`], ['Attached to', `${o.parent.name} router #${o.parent.id}`], ['Buildings', cityState.loaded[o.key] ? `${cityState.loaded[o.key]} from OpenStreetMap` : cityState.failed[o.key] ? 'not available' : 'load when you zoom in'], ['Parcels in the network now', offices.getFlowsFrom(o.key).length]]
    });
    addLabel(`${o.name} · illustrative`, fromLatLon(o.lat, o.lon, 0.045), { cls: 'office', minR: 0, maxR: 700, prio: 0, node: o, key: 'office:' + o.key }); // above its roof
    shell.addSearch({ name: o.name, alt: o.parent.name + ' office', sub: 'Illustrative office', go: () => { shell.showNode(o); goInside(o); } });
  }
  shell.addSearch({ name: 'Offices', sub: 'Five illustrative offices', go: () => flyTo('pakistan') });
  cityState.onStatus = (k, ok) => { if (!ok && tr.key === k) shell.hint('Buildings for this city could not be loaded; the network still works.', 4000); };

  return { open, close, state: tr };
}

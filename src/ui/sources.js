// About, sources and credits (opened from the brand card), and the first-visit
// "representative topology" notice. The source list is generated at build time
// from docs/REFERENCES.md, so the app and the reference document never disagree.
import { ui } from './dom.js';

const LIBS = [
  ['three.js', 'MIT licence', 'https://threejs.org'],
  ['Natural Earth (borders, coastline; via world-atlas)', 'public domain', 'https://www.naturalearthdata.com'],
  ['Highcharts map collection (province shapes)', 'derived from Natural Earth', 'https://code.highcharts.com/mapdata/'],
  ['GeoNames (city positions and populations; via all-the-cities)', 'CC BY 4.0', 'https://www.geonames.org'],
  ['Inter typeface', 'SIL Open Font Licence', 'https://rsms.me/inter/'],
  ['polygon-clipping, esbuild, Vitest', 'MIT licence', 'https://www.npmjs.com']
];

const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function initSources() {
  let groups = [];
  try { groups = JSON.parse(ui('sourcesData').textContent); } catch { groups = []; }
  const count = groups.reduce((n, g) => n + g.items.length, 0);

  ui('aboutBody').innerHTML = `
    <section class="ab-note"><b>Representative topology.</b> Pakistan's operators don't publish their internal networks. Corridors here follow motorways and national highways, and which operator runs each one is illustrative. Cable landings, exchanges, the China fibre, the satellite and the 2008 and 2021 incidents come from public sources. Link capacities inside Pakistan, and attack volumes, are labelled assumptions.</section>
    <h3 class="h5">What is simulated</h3>
    <p>Traffic moves as discrete events over links with capacity, delay, FIFO queues and tail drop; each moving dot is a 0.1 Gbit bundle. OSPF and RIP run as real protocols; BGP models 16 networks with inferred business relationships; the adaptive defence is a MAPE-K loop. All figures on screen are measured from the simulation. Time is compressed: packets 2 ms per second on screen; routing on its own faster clocks.</p>
    <h3 class="h5">Data and software</h3>
    <ul class="ab-libs">${LIBS.map(([n, l, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${n}</a><span>${l}</span></li>`).join('')}</ul>
    <h3 class="h5">Sources (${count})</h3>
    <p class="muted">Every fact, parameter and incident is listed with its source, status and notes in <code>docs/REFERENCES.md</code>. Pages accessed 21 November 2026.</p>
    ${groups.map(g => `<details class="ab-group"><summary>${esc(g.title)} <span class="muted">(${g.items.length})</span></summary><ol>${g.items.map(i => `<li><b>${i.id}</b> ${esc(i.text)}${i.url ? ` <a href="${i.url}" target="_blank" rel="noopener">link</a>` : ''}</li>`).join('')}</ol></details>`).join('')}
    <h3 class="h5">Course</h3>
    <p>Computer Networks, SEECS, NUST. The adaptive defence is inspired by Ms. Maryam Sajjad's published work on adaptive security and self-protection for mobile computing; it is not an implementation of it.</p>`;

  const open = () => { ui('about').classList.add('on'); ui('about').setAttribute('aria-hidden', 'false'); };
  const close = () => { ui('about').classList.remove('on'); ui('about').setAttribute('aria-hidden', 'true'); };
  document.querySelector('#header .brand').addEventListener('click', open);
  ui('btnAbout').onclick = e => { e.stopPropagation(); open(); };
  ui('aboutClose').onclick = close;
  ui('about').addEventListener('click', e => { if (e.target.id === 'about') close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && ui('about').classList.contains('on')) close(); });

  // first visit: the notice, once (per browser; storage may be unavailable)
  let seen = false; try { seen = localStorage.getItem('paknet-notice') === '1'; } catch {}
  if (!seen) ui('notice').classList.add('on');
  ui('noticeOk').onclick = () => { ui('notice').classList.remove('on'); try { localStorage.setItem('paknet-notice', '1'); } catch {} };
  ui('noticeMore').onclick = () => { ui('notice').classList.remove('on'); try { localStorage.setItem('paknet-notice', '1'); } catch {} open(); };
}

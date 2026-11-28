// UI audit: visits every screen and state at several window sizes and checks, in the live page,
//   - text on text: two visible pieces of text overlapping
//   - text on a panel: text drawn over a panel / button / card it does not belong to
//   - panel on panel: two separate panels overlapping
//   - out of bounds: text or a panel outside the window
//   - cut off: text clipped by its box (overflow hidden) or by a scrolling box that cannot show it all
// Needs `npm run preview` (port 4173). Writes .verify/ui-audit.json and a screenshot per state.
//   node scripts/ui-audit.mjs [--sizes=1280x720,1440x900,1536x864,1920x1080] [--only=name,name]   (laptop sizes)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2), opt = k => args.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const SIZES = (opt('sizes') || '1280x720,1440x900,1536x864,1920x1080').split(',').map(s => s.split('x').map(Number));
const ONLY = opt('only')?.split(',');
mkdirSync('.verify/ui', { recursive: true });

// Runs in the page: returns the problems on screen right now.
function audit() {
  const W = innerWidth, H = innerHeight, out = [];
  const shown = el => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= +cs.opacity; } return o; };
  const name = el => { if (!el) return '?'; const id = el.closest('[id]')?.id; return (id ? '#' + id : '') + ' ' + el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''); };
  const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  // panels: positioned boxes that paint something (a background, a blur, a border), big enough to matter
  const panels = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el); if (!['fixed', 'absolute', 'sticky'].includes(cs.position)) continue;
    const bg = cs.backgroundColor.match(/[\d.]+/g), alpha = bg ? (bg.length === 4 ? +bg[3] : 1) : 0;
    if (!(alpha > 0.05 || (cs.backdropFilter && cs.backdropFilter !== 'none') || cs.backgroundImage !== 'none')) continue;
    if (el.closest('#maplabels') || el.tagName === 'CANVAS') continue;
    const r = el.getBoundingClientRect(); if (r.width * r.height < 300 || r.width >= W * 0.98 && r.height >= H * 0.98) continue; // full-screen backdrops are meant to cover
    const o = shown(el); if (o < 0.3) continue;
    panels.push({ el, r });
  }
  // text: every visible text node, as the boxes its lines really occupy, trimmed to what its scrolling /
  // clipping boxes actually show (text scrolled out of a panel is not on screen)
  const clip = (q, b) => ({ left: Math.max(q.left, b.left), top: Math.max(q.top, b.top), right: Math.min(q.right, b.right), bottom: Math.min(q.bottom, b.bottom) });
  const area = q => Math.max(0, q.right - q.left) * Math.max(0, q.bottom - q.top);
  const texts = [], tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TITLE)$/.test(el.tagName)) continue;
    if (shown(el) < 0.3) continue;
    const rg = document.createRange(); rg.selectNodeContents(n); const raw = [...rg.getClientRects()].filter(q => q.width > 2 && q.height > 4);
    if (!raw.length) continue;
    let rects = raw.map(q => ({ left: q.left, top: q.top, right: q.right, bottom: q.bottom })), cut = null;
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a); if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const b = a.getBoundingClientRect(), scrolls = /auto|scroll/.test(cs.overflowX + cs.overflowY);
      for (const q of rects) {
        const c = clip(q, b), lost = area(q) - area(c);
        // partly hidden by a box that cannot scroll, or cut at the side of a scrolling one: the reader loses words
        if (lost > 2 && area(c) > 0 && (!scrolls || q.left < b.left - 1 || q.right > b.right + 1)) cut ||= name(a);
      }
      rects = rects.map(q => clip(q, b)).filter(q => area(q) > 4);
      if (!rects.length) break;
    }
    if (cut) out.push({ kind: 'cut off', what: `"${t.slice(0, 48)}"`, where: name(el), box: cut });
    if (!rects.length) continue; // scrolled out of view or hidden on purpose
    texts.push({ el, t: t.slice(0, 48), rects });
  }
  // out of bounds, and text cut short with an ellipsis
  for (const x of texts) {
    for (const q of x.rects) if (q.left < -1 || q.top < -1 || q.right > W + 1 || q.bottom > H + 1) { out.push({ kind: 'out of bounds', what: `"${x.t}"`, where: name(x.el), at: [q.left, q.top, q.right, q.bottom].map(Math.round) }); break; }
    if (x.el.scrollWidth > x.el.clientWidth + 1 && getComputedStyle(x.el).textOverflow === 'ellipsis') out.push({ kind: 'cut off', what: `"${x.t}" (ellipsis)`, where: name(x.el) });
  }
  // text on text
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const A = texts[i], B = texts[j]; if (A.el === B.el) continue;
    let s = 0; for (const a of A.rects) for (const b of B.rects) s += inter(a, b);
    if (s > 12) out.push({ kind: 'text on text', what: `"${A.t}" × "${B.t}"`, where: `${name(A.el)} × ${name(B.el)}` });
  }
  // text on a panel it is not part of
  for (const x of texts) for (const p of panels) {
    if (p.el.contains(x.el)) continue;
    // a panel that sits inside the text's own panel (e.g. a button in a card) is fine if the text is not under it
    let s = 0; for (const q of x.rects) s += inter(q, p.r);
    if (s > 12) {
      // only if the panel is drawn above the text (or the text is a map label / bubble: those must never touch a panel)
      const label = !!x.el.closest('#maplabels, .labels');
      const top = document.elementFromPoint(Math.min(W - 1, Math.max(0, (x.rects[0].left + x.rects[0].right) / 2)), Math.min(H - 1, Math.max(0, (x.rects[0].top + x.rects[0].bottom) / 2)));
      if (label || (top && !x.el.contains(top) && !top.contains(x.el) && p.el.contains(top)) || (top && x.el.contains(top) === false && !p.el.contains(x.el) && x.el.closest('[id]') !== p.el.closest('[id]'))) out.push({ kind: 'text on a panel', what: `"${x.t}"`, where: `${name(x.el)} on ${name(p.el)}` });
    }
  }
  // panels on panels and panels out of the window
  for (let i = 0; i < panels.length; i++) {
    const A = panels[i];
    if (A.r.left < -1 || A.r.top < -1 || A.r.right > W + 1 || A.r.bottom > H + 1) out.push({ kind: 'out of bounds', what: 'panel', where: name(A.el), at: [A.r.left, A.r.top, A.r.right, A.r.bottom].map(Math.round) });
    for (let j = i + 1; j < panels.length; j++) {
      const B = panels[j]; if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
      if (inter(A.r, B.r) > 30) out.push({ kind: 'panel on panel', what: '', where: `${name(A.el)} × ${name(B.el)}` });
    }
  }
  // the same problem reported twice is one problem
  const seen = new Set(); return out.filter(o => { const k = o.kind + o.what + o.where; if (seen.has(k)) return false; seen.add(k); return true; });
}

const click = sel => async p => { await p.click(sel, { timeout: 3000 }).catch(() => {}); };
const shot = k => async p => { await p.evaluate(k => window.__paknet.shots[k](), k); };
const STATES = [
  ['intro', async () => {}],
  ['start', async p => { await p.evaluate(() => window.__paknet.ctx.shell.start(true)); await p.waitForTimeout(2500); }],
  ['tour-1', shot('tour-1')], ['tour-3', shot('tour-3')], ['tour-8', shot('tour-8')],
  ['search', async p => { await p.evaluate(() => window.__paknet.shots.pakistan()); await p.click('#searchInput').catch(() => {}); await p.keyboard.type('Ka'); }],
  ['menu-layers', async p => { await p.keyboard.press('Escape'); await click('#tLayers')(p); }],
  ['menu-scenarios', async p => { await p.keyboard.press('Escape'); await click('#tScen')(p); }],
  ['help', async p => { await p.keyboard.press('Escape'); await click('#tHelp')(p); }],
  ['pakistan', async p => { await p.keyboard.press('Escape'); await shot('pakistan')(p); }],
  ['info-card', shot('info-card')], ['karachi', shot('karachi')], ['city-300m', shot('city-300m')],
  ['traceroute', shot('traceroute')], ['traceroute-pk', shot('traceroute-pk')],
  ['sat-far', shot('sat-far')], ['sat-near', shot('sat-near')], ['paksat-close', shot('paksat-close')],
  ['scenario-aae1', shot('scenario-aae1')], ['scenario-kkh', shot('scenario-kkh')], ['scenario-ddos', shot('scenario-ddos')], ['scenario-hijack', shot('scenario-hijack')], ['scenario-rip', shot('scenario-rip')],
  ['watch', shot('watch')], ['present', shot('present')], ['expert', shot('expert')]
];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = {};
for (const [w, h] of SIZES) {
  const tag = `${w}x${h}`, page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:4173/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__paknetReady, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  for (const [nm, setup] of STATES) {
    if (ONLY && !ONLY.includes(nm)) continue;
    try { await setup(page); } catch (e) { (report[tag] ||= {})[nm] = [{ kind: 'state failed', what: e.message.slice(0, 120) }]; continue; }
    await page.waitForTimeout(nm.startsWith('scenario') || nm === 'watch' ? 4500 : 3500);
    const issues = await page.evaluate(audit);
    (report[tag] ||= {})[nm] = issues;
    await page.screenshot({ path: `.verify/ui/${tag}-${nm}.png`, timeout: 60000 }).catch(e => console.warn(`${tag} ${nm}: no screenshot (${e.message.split('\n')[0]})`)); // a slow frame is not a layout problem
  }
  if (errors.length) report[tag].pageErrors = errors.slice(0, 5);
  await page.close();
}
await browser.close();
writeFileSync('.verify/ui-audit.json', JSON.stringify(report, null, 1));
let total = 0;
for (const [tag, states] of Object.entries(report)) for (const [nm, list] of Object.entries(states)) {
  if (!Array.isArray(list) || !list.length) continue; total += list.length;
  console.log(`\n${tag} ${nm}: ${list.length}`);
  for (const o of list.slice(0, 12)) console.log(`  ${o.kind}: ${o.what} ${o.where || ''}${o.box ? ' in ' + o.box : ''}${o.at ? ' at ' + o.at : ''}`);
  if (list.length > 12) console.log(`  … ${list.length - 12} more`);
}
console.log(`\n${total} problems in ${SIZES.length} sizes`);

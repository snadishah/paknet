// Nothing in the interface appears, disappears or changes in a single frame (Quality Bar).
// - Panels, cards, menus and pop-ups fade in when they get the class "on" (CSS), and fade out
//   when they lose it: initFades keeps them shown with "leaving" for 300 ms while they fade.
// - patchHtml updates a card in place: only the parts that changed are touched, and changed
//   sentences fade in (numbers ticking every second just update, without blinking).

const FADED = '#note, #conv, #notice, #about, .pop, #insp, #search ul, #menuLayers, #infocard, #menuScen, #scen, #tourcard, #capbar, #trace, #pane-story';
const OUT_MS = 300;
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initFades(root = document) {
  const mo = new MutationObserver(recs => {
    for (const r of recs) {
      const el = r.target, was = (r.oldValue || '').split(/\s+/).includes('on'), now = el.classList.contains('on');
      if (was && !now && !still()) { el.classList.add('leaving'); clearTimeout(el._fade); el._fade = setTimeout(() => el.classList.remove('leaving'), OUT_MS); }
      else if (now && el.classList.contains('leaving')) { clearTimeout(el._fade); el.classList.remove('leaving'); }
    }
  });
  root.querySelectorAll(FADED).forEach(el => mo.observe(el, { attributes: true, attributeFilter: ['class'], attributeOldValue: true }));
}

// Set el's content to html, changing only what differs. Returns true if anything changed.
export function patchHtml(el, html) {
  if (el._html === html) return false;
  el._html = html;
  if (!el.firstChild) { el.innerHTML = html; return true; }
  const t = document.createElement('template'); t.innerHTML = html;
  morph(el, t.content);
  return true;
}
const shape = t => t.replace(/[\d.,]+/g, '#'); // a number that ticks keeps its shape
function morph(a, b) {
  const an = [...a.childNodes], bn = [...b.childNodes];
  for (let i = 0; i < bn.length; i++) {
    const x = an[i], y = bn[i];
    if (!x) { const n = y.cloneNode(true); a.appendChild(n); flash(n); continue; }
    if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) { const n = y.cloneNode(true); a.replaceChild(n, x); flash(n); continue; }
    if (x.nodeType === 3) { if (x.nodeValue !== y.nodeValue) { const quiet = shape(x.nodeValue) === shape(y.nodeValue); x.nodeValue = y.nodeValue; if (!quiet) flash(a); } continue; }
    if (x.nodeType !== 1) continue;
    for (const { name, value } of [...y.attributes]) if (x.getAttribute(name) !== value && !(name === 'open' && x.nodeName === 'DETAILS')) x.setAttribute(name, value);
    for (const { name } of [...x.attributes]) if (!y.hasAttribute(name) && !(name === 'open' && x.nodeName === 'DETAILS') && name !== 'class') x.removeAttribute(name);
    if (x.getAttribute('class') !== y.getAttribute('class')) { const keep = x.classList.contains('chg'); x.setAttribute('class', y.getAttribute('class') || ''); if (keep) x.classList.add('chg'); }
    morph(x, y);
  }
  for (let i = an.length - 1; i >= bn.length; i--) a.removeChild(an[i]);
}
function flash(n) {
  if (n?.nodeType !== 1 || still()) return;
  n.classList.remove('chg'); void n.offsetWidth; n.classList.add('chg');
}

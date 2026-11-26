// Glossary: every technical word gets a tooltip a child can understand.
// gloss(text) marks known words in a plain-text string and returns safe HTML;
// one shared tooltip follows hover and keyboard focus.
export const GLOSSARY = {
  packet: 'A tiny parcel of data. Big messages are cut into many packets.',
  parcel: 'Our word for a packet: a tiny piece of a message.',
  router: 'A post office for packets. It reads the address and picks the next road.',
  cable: 'A long wire or glass thread that carries packets, on land or under the sea.',
  'undersea cable': 'A cable on the sea floor that joins countries.',
  ixp: 'Internet exchange: a meeting place where networks swap packets directly.',
  'internet exchange': 'A meeting place where networks swap packets directly.',
  bgp: 'The way big networks tell each other which roads lead where.',
  latency: 'How long a packet takes to arrive. Less is faster.',
  delay: 'How long a packet takes to arrive. Less is faster.',
  satellite: 'A machine flying around the Earth. Some carry internet signals.',
  geostationary: 'So high and so fast that it seems to stand still over one spot.',
  'low orbit': 'Close to Earth: a few hundred kilometres up, circling every 1.5 hours.',
  'landing station': 'The building where an undersea cable comes out of the sea.',
  'data centre': 'A building full of computers that store websites and videos.',
  ddos: 'When too many fake visitors crowd a website so real people cannot get in.',
  botnet: 'Many hacked phones or computers that a bad person controls together.',
  rpki: 'A stamp of approval that proves who really owns an internet address.',
  dns: "The internet's address book: it turns names like facebook.com into numbers.",
  rip: 'An old way for routers to share directions by counting steps.',
  ospf: 'A way for routers to share a full map of the roads.',
  convergence: 'The moment every router agrees on the new roads again.',
  traceroute: 'A list of every stop a packet makes on its trip.',
  microwave: 'Radio beams that jump from tower to tower.'
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEYS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
const RE = new RegExp(`\\b(${KEYS.map(k => k.replace(/ /g, '\\s')).join('|')})(s|es)?\\b`, 'gi');

// Plain text → HTML with glossary terms marked (each term once per call).
export function gloss(text) {
  const seen = new Set();
  return esc(text).replace(RE, (m, w) => {
    const k = w.toLowerCase().replace(/\s+/g, ' '); if (seen.has(k) || !GLOSSARY[k]) return m; seen.add(k);
    return `<span class="gl" tabindex="0" data-g="${esc(k)}">${m}</span>`;
  });
}

export function initGlossary() {
  const tip = document.createElement('div'); tip.id = 'glosstip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
  const show = el => {
    const k = el.dataset.g; tip.innerHTML = `<b>${esc(el.textContent)}</b>${esc(GLOSSARY[k] || '')}`; tip.classList.add('on');
    const r = el.getBoundingClientRect(), w = Math.min(280, innerWidth - 24);
    tip.style.width = w + 'px'; tip.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + 'px';
    const above = r.top > 140; tip.style.top = (above ? r.top - 10 : r.bottom + 10) + 'px'; tip.style.transform = above ? 'translateY(-100%)' : 'none';
  };
  const hide = () => tip.classList.remove('on');
  document.addEventListener('pointerover', e => { const g = e.target.closest?.('.gl'); if (g) show(g); });
  document.addEventListener('pointerout', e => { if (e.target.closest?.('.gl')) hide(); });
  document.addEventListener('focusin', e => { if (e.target.classList?.contains('gl')) show(e.target); });
  document.addEventListener('focusout', e => { if (e.target.classList?.contains('gl')) hide(); });
  document.addEventListener('click', e => { const g = e.target.closest?.('.gl'); if (g) { e.stopPropagation(); tip.classList.contains('on') ? hide() : show(g); } }, true);
}

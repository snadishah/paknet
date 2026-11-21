// Small DOM helpers shared by the UI modules.
export const ui = id => document.getElementById(id);

let noteTimer = null;
export function note(msg, kind = '') {
  const t = ui('note'); t.className = 'on ' + kind; t.innerHTML = msg;
  clearTimeout(noteTimer); noteTimer = setTimeout(() => t.className = '', 4200);
}

export function setTab(t) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + t));
}

export function alertFeed(html, kind) {
  const box = ui('alerts'); if (box.querySelector('.empty')) box.innerHTML = '';
  const el = document.createElement('div'); el.className = 'alert ' + kind; el.innerHTML = html; box.prepend(el);
  while (box.children.length > 8) box.lastChild.remove();
}

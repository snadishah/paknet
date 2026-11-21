// Small DOM helpers shared by the UI modules.
export const ui = id => document.getElementById(id);

let noteTimer = null;
export function note(msg, kind = '') {
  const t = ui('note'); t.className = 'on ' + kind; t.innerHTML = msg;
  clearTimeout(noteTimer); noteTimer = setTimeout(() => t.className = '', 4200);
}

const TITLES = { overview: 'Overview', route: 'Route', failures: 'Failures', security: 'Security', metrics: 'Metrics' };
let currentTab = 'overview';
const tabListeners = [];
export const onTabChange = fn => tabListeners.push(fn);
export const activeTab = () => currentTab;
export const panelOpen = () => document.body.classList.contains('panel-open');

export function openPanel() { document.body.classList.add('panel-open'); syncRail(); }
export function closePanel() { document.body.classList.remove('panel-open'); syncRail(); }
function syncRail() { document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', panelOpen() && b.dataset.tab === currentTab)); }

// Show a tab and open the panel (scenarios call this too).
export function setTab(t) {
  const prev = currentTab; currentTab = t;
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + t));
  ui('panelTitle').textContent = TITLES[t] || t;
  openPanel();
  if (prev !== t) tabListeners.forEach(fn => fn(t, prev));
}

export function alertFeed(html, kind) {
  const box = ui('alerts'); if (box.querySelector('.empty')) box.innerHTML = '';
  const el = document.createElement('div'); el.className = 'alert ' + kind; el.innerHTML = html; box.prepend(el);
  while (box.children.length > 8) box.lastChild.remove();
}

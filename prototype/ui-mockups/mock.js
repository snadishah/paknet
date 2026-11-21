// PAKNET UI mockups: shared behaviour. Throwaway (docs/PLAN.md step 2).
// - Loads the real app as a live backdrop and hides its own UI.
// - Wires tabs, the story-mode toggle and the mobile sheet.
(function () {
  // one consistent line-icon set (16px grid, 1.6 stroke) replacing the unicode glyphs
  const P = {
    overview: '<rect x="2" y="2" width="5" height="5" rx="1.2"/><rect x="9" y="2" width="5" height="5" rx="1.2"/><rect x="2" y="9" width="5" height="5" rx="1.2"/><rect x="9" y="9" width="5" height="5" rx="1.2"/>',
    route: '<circle cx="3.5" cy="12.5" r="1.6"/><circle cx="12.5" cy="3.5" r="1.6"/><path d="M5 12.5h4.5a2.5 2.5 0 0 0 0-5h-3a2.5 2.5 0 0 1 0-5H11"/>',
    failures: '<path d="M8 1.8 14.5 13.5h-13z"/><path d="M8 6.2v3.3M8 11.6v.1"/>',
    security: '<path d="M8 1.8 13.5 4v4c0 3.2-2.3 5.4-5.5 6.2C4.8 13.4 2.5 11.2 2.5 8V4z"/><path d="m5.8 8 1.6 1.6L10.5 6.5"/>',
    metrics: '<path d="M2 13.5h12"/><path d="M4 11V7.5M7 11V4M10 11V8.5M13 11V5.5"/>',
    layers: '<path d="M8 1.8 1.8 5 8 8.2 14.2 5z"/><path d="M1.8 8 8 11.2 14.2 8"/><path d="M1.8 11 8 14.2 14.2 11"/>',
    views: '<rect x="1.8" y="3.8" width="12.4" height="9" rx="2"/><circle cx="8" cy="8.3" r="2.4"/><path d="M5.5 3.8 6.5 2h3l1 1.8"/>',
    legend: '<circle cx="8" cy="8" r="6.2"/><path d="M8 7.2v3.8M8 4.9v.1"/>',
    stories: '<path d="M2.5 3.2c2-.9 3.9-.9 5.5.4 1.6-1.3 3.5-1.3 5.5-.4v9.6c-2-.9-3.9-.9-5.5.4-1.6-1.3-3.5-1.3-5.5-.4z"/><path d="M8 3.6v9.6"/>',
    play: '<path d="M5 3.2v9.6l7.6-4.8z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M5.2 3.2v9.6M10.8 3.2v9.6" stroke-width="2.4"/>',
    prev: '<path d="m9.8 3.5-4.5 4.5 4.5 4.5"/>',
    next: '<path d="m6.2 3.5 4.5 4.5-4.5 4.5"/>',
    close: '<path d="m4 4 8 8M12 4l-8 8"/>',
    flag: '<path d="M3.5 14.2V2.2"/><path d="M3.5 2.8h8.2l-1.6 2.8 1.6 2.8H3.5"/>',
    cable: '<path d="M2 11c2.2 0 2.2-6 4.4-6s2.2 6 4.4 6c1.1 0 1.7-1.5 2.2-3"/><circle cx="13.6" cy="6.4" r="1.2"/>',
    mountain: '<path d="M1.5 13.2 6 5.2l2.6 4.3 1.7-2.7 4.2 6.4z"/>',
    anchor: '<circle cx="8" cy="3.4" r="1.4"/><path d="M8 4.8v9.4M4.6 7.2h6.8"/><path d="M2.5 9.5c.4 2.8 2.7 4.7 5.5 4.7s5.1-1.9 5.5-4.7"/>',
    globe: '<circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4M8 1.8c1.8 1.9 2.6 4 2.6 6.2S9.8 12.3 8 14.2C6.2 12.3 5.4 10.2 5.4 8S6.2 3.7 8 1.8"/>',
    phone: '<rect x="4.2" y="1.8" width="7.6" height="12.4" rx="1.6"/><path d="M7.2 12h1.6"/>',
    collapse: '<path d="M10.5 3.5 6 8l4.5 4.5"/><path d="M13.5 2.5v11"/>',
    menu: '<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>'
  };
  const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sprite.setAttribute('style', 'display:none');
  sprite.innerHTML = Object.entries(P).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 16 16">${v}</symbol>`).join('');
  document.body.prepend(sprite);

  const map = document.createElement('iframe');
  map.id = 'map'; map.src = '/'; map.title = 'Live map';
  document.body.prepend(map);
  map.addEventListener('load', () => {
    const d = map.contentDocument; if (!d) return;
    const s = d.createElement('style');
    s.textContent = '#brand,#kpis,#panel,#dock,.pop,#player,#note,#conv,#tip,#insp{display:none!important}';
    d.head.appendChild(s);
    // frame the map for this layout (variants set data-view on <body>)
    const v = document.body.dataset.view;
    if (v) setTimeout(() => map.contentWindow.__flyTo?.(v, 10), 50);
  });

  // tabs: [data-tab="x"] buttons show [data-pane="x"]
  document.addEventListener('click', ev => {
    const t = ev.target.closest('[data-tab]');
    if (t) {
      const group = t.closest('[data-tabs]') || document;
      group.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b === t));
      document.querySelectorAll('[data-pane]').forEach(p => p.classList.toggle('hide', p.dataset.pane !== t.dataset.tab));
      document.body.classList.add('panel-open');
    }
    if (ev.target.closest('[data-story]')) {
      document.body.classList.toggle('story');
      if (document.body.classList.contains('story')) map.contentWindow.__flyTo?.('karachi', 1600);
      else map.contentWindow.__flyTo?.(document.body.dataset.view || 'overview', 1600);
    }
    if (ev.target.closest('[data-collapse]')) document.body.classList.toggle('panel-open');
    if (ev.target.closest('[data-sheet]')) document.body.classList.toggle('sheet-up');
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') document.body.classList.remove('story'); });
})();

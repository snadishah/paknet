// Satellite controls in the layman UI: Near / Far toggles (one plain sentence
// each), search entries, click-to-learn and the "Show near / far" camera moves.
import { satLayers, applyLayers, pickSatellite, findSat, firstOfGroup } from '../render/satellites.js';
import { GROUPS } from '../sat/catalog.js';
import { flyTo } from '../render/globecam.js';
import { PAKSAT_VIEW } from '../render/paksat3d.js';

export function initSatelliteUI(ctx) {
  const sh = ctx.shell;
  const set = (k, v) => { satLayers[k] = v; applyLayers(); if (k === 'far') ctx.setLayer('satellite', v); };
  sh.satToggles = [
    ['Far satellites · 36,000 km up', 'So high they seem to stand still over one spot. PakSat-MM1 lives here.', () => satLayers.far, v => set('far', v)],
    ['Near satellites · 500–1,200 km up', 'Low and fast: once round the Earth in about 1.5 hours. Not licensed in Pakistan yet.', () => satLayers.soon, v => set('soon', v)],
    ["Pakistan's eyes in space", 'Satellites that take pictures, not internet.', () => satLayers.eyes, v => set('eyes', v)],
    ['Navigation (GPS, BeiDou)', 'They tell your phone where it is. Navigation, not internet.', () => satLayers.nav, v => set('nav', v)]
  ];
  sh.pickExtra = (x, y) => pickSatellite(x, y);

  const closeUp = ['See it up close', () => flyTo(PAKSAT_VIEW(), 4200)]; // a representative model (DFH-4E platform)
  const MODEL_TAG = ['Close-up: representative 3D model', 'grey'];
  const nearFar = [['Show near satellites', () => { set('soon', true); sh.renderLayers(); flyTo('near'); }], ['Show far satellites', () => { set('far', true); flyTo('far'); }]];
  const card = s => { if (!s) { sh.hint('Satellites are still loading. Try again in a moment.', 3000); return; } const info = s.describe(); sh.showInfo({ ...info, tags: [...(info.tags || []), ...(s.norad === 59915 ? [MODEL_TAG] : [])], buttons: s.norad === 59915 ? [closeUp, ...nearFar] : nearFar }); sh.selected = { name: s.name }; };
  const showSat = (norad, view) => { set(norad === 37779 ? 'far' : 'far', true); card(findSat(norad)); flyTo(view); };
  sh.addSearch({ name: 'PakSat-MM1', alt: 'PakSat', sub: "Pakistan's internet satellite", go: () => showSat(59915, 'far') });
  sh.addSearch({ name: 'PakSat-1R', sub: 'Retired satellite (Aug 2026)', go: () => showSat(37779, 'far') });
  for (const [key, g] of Object.entries(GROUPS)) {
    if (key === 'paksat' || key === 'telesat') continue; // Telesat Lightspeed: nothing in orbit to show
    sh.addSearch({ name: g.label, sub: g.role === 'soon' ? 'Coming soon — not licensed yet' : g.role === 'eyes' ? 'Takes pictures, not internet' : 'Navigation, not internet', go: () => { set(g.layer, true); sh.renderLayers(); card(firstOfGroup(key)); flyTo(g.orbit === 'meo' ? { lat: 20, lon: 60, range: 58000 } : 'near'); } });
  }
  sh.addSearch({ name: 'Satellites near', sub: 'Low orbit', go: () => nearFar[0][1]() });
  sh.addSearch({ name: 'Satellites far', sub: 'Geostationary', go: () => nearFar[1][1]() });
  // a click on PakSat-MM1 from the network node opens the satellite card too
  const satNode = ctx.G.SAT; satNode.describe = () => { const s = findSat(59915); return s ? { ...s.describe(), tags: [...(s.describe().tags || []), MODEL_TAG], buttons: [closeUp, ...nearFar] } : { title: 'PakSat-MM1', what: 'Loading…' }; };
  return { set, card };
}

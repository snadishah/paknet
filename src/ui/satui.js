// Satellite controls in the layman UI: Near / Far toggles (one plain sentence
// each), search entries, click-to-learn and the "Show near / far" camera moves.
import { satLayers, applyLayers, pickSatellite, findSat, firstOfGroup, satMeta } from '../render/satellites.js';
import { GROUPS } from '../sat/catalog.js';
import { flyTo } from '../render/globecam.js';

export function initSatelliteUI(ctx) {
  const sh = ctx.shell;
  const set = (k, v) => { satLayers[k] = v; applyLayers(); if (k === 'far') ctx.setLayer('satellite', v); };
  sh.satToggles = [
    ['Far: geostationary (35,786 km)', 'So high they seem to stand still over one spot. PakSat-MM1 lives here.', () => satLayers.far, v => set('far', v)],
    ['Near: low orbit (~500–1,200 km)', 'Low and fast: once round the Earth in about 1.5 hours. Not licensed in Pakistan yet.', () => satLayers.soon, v => set('soon', v)],
    ["Pakistan's eyes in space", 'Satellites that take pictures, not internet.', () => satLayers.eyes, v => set('eyes', v)],
    ['Navigation (GPS, BeiDou)', 'They tell your phone where it is. Navigation, not internet.', () => satLayers.nav, v => set('nav', v)]
  ];
  sh.pickExtra = (x, y) => pickSatellite(x, y);

  const nearFar = [['Show near satellites', () => { set('soon', true); sh.renderLayers(); flyTo('near'); }], ['Show far satellites', () => { set('far', true); flyTo('far'); }]];
  const card = s => { if (!s) return; const info = s.describe(); sh.showInfo({ ...info, buttons: nearFar }); sh.selected = { name: s.name }; };
  const showSat = (norad, view) => { set(norad === 37779 ? 'far' : 'far', true); card(findSat(norad)); flyTo(view); };
  sh.addSearch({ name: 'PakSat-MM1', alt: 'PakSat', sub: "Pakistan's internet satellite", go: () => showSat(59915, 'far') });
  sh.addSearch({ name: 'PakSat-1R', sub: 'Retired satellite (Aug 2026)', go: () => showSat(37779, 'far') });
  for (const [key, g] of Object.entries(GROUPS)) {
    if (key === 'paksat' || !satMeta.groups[key]) continue;
    sh.addSearch({ name: g.label, sub: g.role === 'soon' ? 'Coming soon — not licensed yet' : g.role === 'eyes' ? 'Takes pictures, not internet' : 'Navigation, not internet', go: () => { set(g.layer, true); sh.renderLayers(); card(firstOfGroup(key)); flyTo(g.orbit === 'meo' ? { lat: 20, lon: 60, range: 58000 } : 'near'); } });
  }
  sh.addSearch({ name: 'Satellites near', sub: 'Low orbit', go: () => nearFar[0][1]() });
  sh.addSearch({ name: 'Satellites far', sub: 'Geostationary', go: () => nearFar[1][1]() });
  // a click on PakSat-MM1 from the network node opens the satellite card too
  const satNode = ctx.G.SAT; satNode.describe = () => ({ ...findSat(59915).describe(), buttons: nearFar });
  return { set, card };
}

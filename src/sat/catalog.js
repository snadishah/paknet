// Satellite groups shown on the globe, with honest labels. Pure (no three.js, no DOM).
// Facts and sources: docs/REFERENCES.md §8.2. Orbit snapshot: src/data/satellites.json.
//
// role: 'pk'     carries Pakistani traffic (only PakSat-MM1)
//       'retired' greyed, no service
//       'soon'   "Coming soon — not yet licensed in Pakistan (as of late 2026)"
//       'eyes'   Earth observation (pictures, not internet)
//       'nav'    navigation, not internet
// orbit: 'geo' (far) or 'leo' / 'meo' (near / middle)
export const SOON = 'Coming soon — not yet licensed in Pakistan (as of late 2026)';

export const GROUPS = {
  paksat: { label: 'PakSat', role: 'pk', orbit: 'geo', layer: 'far' },
  starlink: { label: 'Starlink', role: 'soon', orbit: 'leo', layer: 'soon', owner: 'SpaceX (USA)', tracks: 2 },
  oneweb: { label: 'OneWeb', role: 'soon', orbit: 'leo', layer: 'soon', owner: 'Eutelsat OneWeb (UK/France)', tracks: 2 },
  kuiper: { label: 'Amazon Kuiper (Leo)', role: 'soon', orbit: 'leo', layer: 'soon', owner: 'Amazon (USA)', tracks: 2 },
  qianfan: { label: 'Qianfan (Shanghai Spacecom)', role: 'soon', orbit: 'leo', layer: 'soon', owner: 'Shanghai Spacecom Satellite Technology (China)', tracks: 2 },
  telesat: { label: 'Telesat Lightspeed', role: 'soon', orbit: 'leo', layer: 'soon', owner: 'Telesat (Canada)', tracks: 0 },
  eyes: { label: "Pakistan's eyes in space", role: 'eyes', orbit: 'leo', layer: 'eyes', owner: 'SUPARCO (Pakistan)', tracks: 1 },
  gps: { label: 'GPS', role: 'nav', orbit: 'meo', layer: 'nav', owner: 'US Space Force', tracks: 1 },
  beidou: { label: 'BeiDou', role: 'nav', orbit: 'meo', layer: 'nav', owner: 'China', tracks: 0 }
};

// Plain-English cards. Facts: REFERENCES §8.2.
export const SAT_INFO = {
  59915: { title: 'PakSat-MM1', kick: "Pakistan's internet satellite", tags: [['Carries Pakistani traffic', 'live']],
    what: "Pakistan's own communication satellite. It sits 35,786 km above the equator, so it seems to stand still over one spot.",
    why: 'Big dishes in Karachi, Lahore and Islamabad and small dishes in far-away towns talk to it. Places with no cables can still get online.',
    facts: [['Launched', '30 May 2024 (Long March 3B)'], ['In service since', '18 Sep 2024'], ['Orbit', 'Geostationary, 38.2°E'], ['Radio bands', 'C, Ku, Ka and L (48 transponders)']] },
  37779: { title: 'PakSat-1R', kick: 'Retired satellite', tags: [['Retired Aug 2026', 'grey']],
    what: "Pakistan's older communication satellite, launched in 2011.",
    why: 'It finished its work and was moved out of the way in August 2026. PakSat-MM1 took over.',
    facts: [['Launched', '11 Aug 2011'], ['Retired', 'Aug 2026 (deorbited per Starpath Global)'], ['Old slot', '38°E']] }
};

export const GROUP_INFO = {
  soon: (g, n) => ({ kick: 'Low-orbit internet satellites', title: g.label, tags: [[SOON, 'grey'], ...(n.sampled ? [[`Showing a sample of ${n.shown} of ${n.total.toLocaleString()}`, 'grey']] : [])],
    what: `A swarm of small satellites flying only a few hundred kilometres up, circling Earth in about 1.5 hours. Owner: ${g.owner}.`,
    why: 'Because they are close, messages come back fast. They are not allowed to sell internet in Pakistan yet.' }),
  eyes: (g) => ({ kick: "Pakistan's eyes in space", title: g.label, tags: [['Takes pictures, not internet', 'grey']],
    what: 'Pakistani satellites (PRSS-1 and the PRSC satellites) that take pictures of the ground from low orbit.',
    why: 'They help with maps, farming and disasters. They do not carry internet traffic.' }),
  nav: (g) => ({ kick: 'Navigation satellites', title: g.label, tags: [['Navigation, not internet', 'grey']],
    what: 'Satellites about 20,000 km up that send time signals. Your phone uses them to know where it is.',
    why: 'Maps on your phone need them, but they do not carry internet traffic.' })
};

// Rebuild OMM objects from the compact snapshot rows.
export function decodeSnapshot(snap) {
  const out = {};
  for (const [k, g] of Object.entries(snap.groups || {})) out[k] = { ...g, sats: g.sats.map(row => Array.isArray(row) ? Object.fromEntries(snap.fields.map((f, i) => [f, row[i]])) : row) };
  return out;
}

// Shared mutable simulation state. One object, imported where needed, so the
// globals that used to live at the top of main.js have a single home.
export const state = {
  // topology / routing
  protocol: 'OSPF',       // routing protocol: 'OSPF' and 'RIP' are simulated; 'BGP' convergence is still mocked
  plannedActive: false,   // Gwadar landing + CPEC-II fibre what-if
  epoch: 0,               // bumps on every topology change (route-cache key)
  staleSet: new Set(),    // edge ids routers still believe are up while converging
  convergeStart: 0, convergeUntil: 0, convergeT: 0, lastConv: 0,
  // playback
  simHour: 21, speed: 1, playing: true,
  // route tab
  algo: 'dijkstra', metric: 'latency',
  // security
  defense: true,
  scen: { hijack: null, ddos: null, mal: null, fb: null }
};

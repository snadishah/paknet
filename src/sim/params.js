// Model parameters and representative figures. Every value here has an entry
// in docs/REFERENCES.md (section numbers in the comments); keep the two in sync.
// "Assumption" means no public figure exists and the value is a labelled guess.

/* ---------- propagation ---------- */
// ~5 µs per km in fibre (refractive index ≈ 1.47). REFERENCES §3.
export const FIBRE_US_PER_KM = 5;
// Fibre route length ÷ straight-line distance. Singla et al. (HotNets 2014):
// 1.5–2× road distance. 1.5 is a labelled assumption. REFERENCES §0 #12, §3.
export const ROUTE_FACTOR = 1.5;
export const propDelayMs = km => km * ROUTE_FACTOR * FIBRE_US_PER_KM / 1000;
// Geostationary hop: ~35,786 km up and down at the speed of light ≈ 120 ms each way.
export const GEO_HOP_MS = 120;

/* ---------- traffic model ---------- */
// Each moving dot is a BUNDLE of traffic, not one IP packet: simulating Tbps
// packet by packet is impossible in a browser. The KPIs scale bundles back up.
export const BUNDLE_GBIT = 0.1;
// Slow motion: network milliseconds that pass per wall-clock second at 1×.
// Karachi → Lahore (~8 ms one way) then takes ~4 s on screen.
export const TIME_SCALE_MS = 2;
// Offered load at the evening peak (all classes). Chosen so peak international
// demand (~62%) uses ~70% of lit cable capacity. Assumption.
export const PEAK_OFFERED_TBPS = 18;
// Share of bundles per traffic class (sums to 1). Assumption, see REFERENCES §3 (gravity model).
export const CLASS_SHARE = { intl: 0.62, dom: 0.193, cdn: 0.12, sat: 0.002, china: 0.015, border: 0.01 };
// Gravity model: traffic between places ∝ the product of their populations
// (Roughan 2005, REFERENCES §3), so each end is picked in proportion to population.
export const GRAVITY_EXPONENT = 1;
export const MIN_POP = 15000; // floor for places without a population figure
// Router buffers: B = RTT × C / √n (Appenzeller et al. 2004, REFERENCES §3) with a
// reference RTT of 100 ms and n ≈ 400 flows per bundle stream → 5 ms of line rate.
export const BUFFER_MS = 5;
// Latency probes (tiny bundles, Karachi ↔ Lahore) every this many network ms.
export const PROBE_EVERY_MS = 0.5;

/* ---------- routing protocols ---------- */
// RIP sends its whole table every 30 s (RFC 2453 §3.8). Routing time is
// compressed separately from packet time: one RIP round every DV_ROUND_S wall
// seconds at 1×, so count-to-infinity plays out in ~10 s instead of ~7 minutes.
export const RIP_UPDATE_S = 30;
export const DV_ROUND_S = 0.7;

// OSPF (RFC 2328; Cisco defaults, REFERENCES §3). Times in ms of OSPF time.
export const OSPF = {
  helloDeadMs: 40000,   // RouterDeadInterval: 4 × HelloInterval 10 s (RFC 2328 App. C.3)
  helloUpMs: 10000,     // a restored link is seen at the next Hello (≤ HelloInterval)
  carrierMs: 50,        // loss of light / BFD detects a fibre cut. Assumption
  lsaDelayMs: 50,       // LSA throttle, initial (Cisco "optimize enabled" default)
  procMs: 2,            // per-hop LSA processing before re-flooding. Assumption
  spfDelayMs: 50,       // SPF throttle, initial (Cisco "optimize enabled" default)
  spfRunMs: 2,          // SPF computation for ~120 routers. Assumption
  refGbps: 100000       // reference bandwidth for cost = ref / link capacity (auto-cost)
};
// OSPF time is compressed separately from packet time: OSPF_MS_PER_S of OSPF
// time per wall second, sped up to OSPF_FAST_MS_PER_S while only a long timer
// (the 40 s dead interval) is pending.
export const OSPF_MS_PER_S = 100;
export const OSPF_FAST_MS_PER_S = 10000;
export const OSPF_LONG_WAIT_MS = 1000;

// BGP (RFC 4271 §10 suggested defaults, REFERENCES §3).
export const BGP = {
  mraiMs: 30000,      // MinRouteAdvertisementInterval for eBGP, × jitter U(0.75, 1)
  sessionDelayMs: 500 // update transmission + processing per session. Assumption
};
// BGP time is compressed: 20 s per wall second while updates are in flight,
// 10 minutes per wall second while only scheduled scenario actions are waiting.
export const BGP_MS_PER_S = 20000;
export const BGP_FAST_MS_PER_S = 600000;
// YouTube traffic in the 2008 scenario (illustrative volumes, not measurements).
export const YT_WORLD_TBPS = 2;   // world users → YouTube, for the address range PTCL hijacked
export const YT_PK_TBPS = 0.4;    // Pakistani users → YouTube
// Share of Pakistani users per AS (assumption; no public split by these ASNs).
export const PK_USER_SHARE = { 17557: 0.45, 38193: 0.15, 9541: 0.12, 23674: 0.08, 9260: 0.08, 38264: 0.08, 18053: 0.04 };

// Adaptive defence (MAPE-K). Assumptions unless noted.
export const DEFENCE = {
  windowMs: 0.5,        // telemetry window, network ms (0.25 s on screen)
  planMs: 0.5,          // automated decision + execution delay, network ms
  rovDeployMs: 5 * 60000 // carriers deploy ROV filters 5 min (BGP time) after a hijack is detected
};
export const SCENARIO_MS = { ddos: 30, mal: 24 }; // how long the attacks run, network ms (15 s / 12 s on screen)
export const BEACON_EVERY_MS = 0.1;               // compromised phones call home every 0.1 network ms

/* ---------- capacities (Gbps, per direction) ---------- */
// Active international capacity per cable. PTA presentation via TechJuice
// (~late 2025): AAE-1 3.58, SMW4 1.98, IMEWE 1.9, TW1 2.6, PEACE 0.8, Pak-China
// OFC 0.45 Tbps; total 13.01 Tbps active. SMW5 is not itemised: 1.7 is the
// remainder of that total (inferred). SMW6: 4 Tbps reported active by MoITT,
// Nov 2025 (sources conflict). Africa-1 / 2Africa / Gwadar: what-if values
// (assumption). REFERENCES §0 #3 #9, §1.1.
export const CABLE_GBPS = { AAE1: 3580, SMW4: 1980, IMEWE: 1900, TW1: 2600, PEACE: 800, SMW5: 1700, SMW6: 4000, AFR1: 2000, '2AFR': 2000, SMW3: 0 };
export const OFC_GBPS = 450;           // Pak-China OFC active (PTA). REFERENCES §1.1.
export const GWADAR_CABLE_GBPS = 2000; // planned Gwadar landing, what-if. Assumption.
// Domestic links: no public figures (internal topology is not public). Assumption.
// A fibre corridor's capacity scales with the operators drawn on it: the
// Karachi–Lahore corridor (4 operators) carries ~10 Tbps, enough for the
// international traffic that leaves Karachi northwards.
export const FIBRE_GBPS_PER_OPERATOR = { trunk: 2500, regional: 1000 }; // trunk = ≥3 operators
export const ACCESS_GBPS_PER_PERSON = 1 / 2500; // a city of 1 million gets 400 Gbps of last mile
export const EDGE_GBPS = {
  metro: 10000,    // landing stations and satellite gateways to their city
  dc: 2500,        // a data centre / CDN edge's uplink (serves ~1/4 of CDN traffic)
  scrub: 10000,    // the scrubbing centre (TWA Tier III, Karachi) used by the DDoS defence
  ixp: 2000,       // an internet exchange's fabric uplink
  access: 100,     // a city's aggregate last mile (minimum; grows with population below)
  mwaccess: 20, microwave: 20, mwbackup: 20, // modern multi-carrier / E-band microwave
  aerial: OFC_GBPS, xborder: 100, planned: 4000,
  satGateway: 5, satTerminal: 1 // PakSat-MM1 per link; no public figure. Assumption.
};

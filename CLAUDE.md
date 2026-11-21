# PAKNET — project context for Claude Code

## What this is
A Computer Networks course project (SEECS, NUST). Instructor: **Ms. Maryam Sajjad** (Lecturer), whose research is adaptive security, mobile computing and network security (self-protecting mobile devices, adaptive access control). She approved the idea.

**Goal:** a three.js simulation of Pakistan's internet: how data travels between cities, ISPs, exchanges and the submarine cables, and how routing algorithms pick paths. It should include failure injection, metrics, and a security extension that links to the instructor's research.

**Current state:** a *visual proof of concept*. The look, the layout and the feature mockups are done. Most behaviour is scripted. The final project should replace the scripted parts with a real simulation (see Roadmap).

## Commands
- `npm install`, then `npm run build` produces `dist/index.html`, a single self-contained file. Open it in a browser.
- `npm run dev` rebuilds on every save and serves `dist/` on http://localhost:5173 (`scripts/serve.mjs`). Refresh the browser to see changes. The Claude preview pane uses the same command via `.claude/launch.json`.
- `npm test` runs the Vitest unit tests (simulation and routing logic only, no rendering).
- The working plan is `docs/PLAN.md`; facts, design decisions and their sources live in `docs/REFERENCES.md`.
- `npm run build:v1` builds the first, neon-styled version into `dist/v1.html` (archived, for reference only).
- `npm run data` regenerates `data/*.json` from the npm geo packages. Rarely needed.
- The dev machine is Windows. Keep scripts cross-platform: Node only, no bash.

## Layout
- `src/main.js` builds the modules, wires events and runs the main loop. The rest of `src/`:
  - `state.js`: the one shared mutable state object. `events.js`: a tiny event bus (`edge:cut`, `edge:restore`, `topology:changed`, `view:changed`).
  - `palette.js`: map, packet and UI colours.
  - `geo/`: projection and layout constants (`projection.js`), province outlines and `snapToCoast` (`coast.js`).
  - `graph/topology.js`: `buildTopology()` returns the graph `G` (nodes, edges, adjacency, cables, CLS, IXPs, DCs, international endpoints, satellite, microwave relays).
  - `routing/`: `dijkstra.js` (Dijkstra, edge weights, heap) and `paths.js` (polyline paths for packets).
  - `sim/`: `network.js` (usable edges, cached routes keyed by the topology `epoch`, cuts and convergence) and `traffic.js` (traffic generator, packet movement).
  - `render/`: `scene.js` (renderer, camera, lights, fat lines, layer registry), `basemap.js`, `network.js` (layer drawing and router glyphs), `labels.js`, `packets.js` (one `THREE.Points` with a custom shader and trails), `fx.js` (bursts, route highlight, cut marks, shields), `heat.js`, `camera.js` (views, fly-to, tour).
  - `ui/`: `dom.js` helpers, `panel.js` (tabs, dock pop-ups, playback), `route.js`, `failures.js`, `security.js`, `metrics.js`, `inspector.js`.
  - `scenarios/`: failure, security and routing demos. These orchestrate sim, render and UI.
  - **Rule:** `routing/` and `sim/` never import rendering or the DOM. They emit events and the rest listens, which keeps them testable in Node (`tests/`).
- `src/template.html` holds the HTML and CSS of the UI. The bundle is inlined at `<script>/*BUNDLE*/</script>`.
- `data/`:
  - `countries.json`: Natural Earth 10m polygons for Pakistan and its neighbours
  - `prov_merged.json`: 6 province polygons in lon/lat, with FATA merged into KP and ICT merged into Punjab
  - `cities.json`: all 443 GeoNames places in Pakistan; 19 relay and border towns are added in code (`EXTRA`)
- `archive/v1/` holds the first, neon version. Kept only for reference.
- `scripts/` holds the build script and the data-extraction scripts.

## Design direction (from the user's feedback — keep to this)
- Style reference: a stylised 3D map of Pakistan with **each province as an extruded slab**, flat colours (greens) and a light background.
- **No neon, no bloom, nothing that looks AI-generated.** Clean, cartographic and calm.
- **Declutter.** By default show only the backbone, cables, core routers, gateways and packets. Everything else is a toggle in the Layers pop-up, or switched on by the scenario that needs it.
- Keep the animated packets. They are the signature visual. Four colours: orange international, blue domestic, teal CDN, purple satellite. Red is reserved for cuts and attacks.
- UI layout (chosen from the mockups in `prototype/ui-mockups/`, Nov 2026):
  - **Desktop, normal:** mockup B with A's header. A floating header card at top left (brand + the five KPIs), with notifications stacked under it. An icon rail on the right (Overview, Route, Failures, Security, Metrics, then Layers, Views, Legend) opens a collapsible side panel. A bottom status strip holds playback, small trend charts (throughput, latency, loss) and the Stories button. KPI numbers appear only in the header.
  - **Desktop, story mode:** B's narrative column. The panel shows the current beat on top and the chapter list below.
  - **Phone, normal:** B. The rail becomes a bottom tab bar, the KPIs a row you can scroll sideways at the top, and the panel a bottom sheet.
  - **Phone, story mode:** C's lower third with the dated timeline.
- Light cards, one consistent line-icon set, an 8 px spacing grid, progressive disclosure, short copy.

## Facts used (checked 21 Nov 2026; sources and full detail in `docs/REFERENCES.md`)
`docs/REFERENCES.md` is the source of truth. Update it first when a fact changes, then the code and this list. Re-check the cable statuses within a week of any demo.
- All of Pakistan's international submarine cables land in **Karachi**, a single point of failure. Nine have landed: SMW4, IMEWE, AAE-1, Africa-1 (PTCL); SMW5, TW1, SMW6, 2Africa (TWA); PEACE (Cybernet). SMW3 is retired. SMW3, SMW4 and IMEWE land at Hawke's Bay, AAE-1 at Clifton beach, Africa-1 at the adjacent Sea View beach.
  - **Africa-1:** landed 22 Feb 2025, **not in service** (TeleGeography: RFS 2027).
  - **2Africa:** landed (announced Feb 2025); **service unconfirmed**.
  - **SMW6:** landed Nov 2025; MoITT reported 4 of 13.2 Tbps active, but TeleGeography still lists RFS 2027. Sources conflict; show "partial".
  - **PEACE:** Karachi only. One source claims a Gwadar landing; don't draw it.
  - **Total international capacity:** sources range from about 13 to 17.7 Tbps. The app uses **13 Tbps lit, labelled representative**.
- **Pak-China OFC (SCO):** about 820 km from Rawalpindi to Khunjerab. **26 microwave links** (backup) between Rawalpindi and Karimabad, plus **about 171–172 km** of aerial fibre from Karimabad to Khunjerab. Phase II (approved Jan 2021) plans Karachi, Gwadar and a Gwadar landing station; its progress is unverified.
- **Exchanges:** PKIX sites in Islamabad, Karachi and Lahore (opened 2017–2021); current activity unverified. **PIE Karachi** (DE-CIX with PTCL) is the only Pakistani IX with listed members (9 networks).
- **PakSat-MM1:** geostationary at 38.2°E, launched 30 May 2024, with gateways over Lahore, Karachi and Islamabad and 11 Ka-band spot beams.
- **AAE-1** fault near Qatar, Jan 2025: PTCL moved about 1.8 Tbps to IMEWE and 1.5 Tbps to SMW4.
- **Sep 2025:** SMW4 and IMEWE cut near Jeddah (SMW5, AAE-1, PEACE unaffected). **20 Oct 2025:** PEACE cut near Sudan. These are two separate events.
- **2008 YouTube hijack:** AS17557 (PTCL) announced 208.65.153.0/24, which leaked through AS3491 (PCCW). YouTube was AS36561 with 208.65.152.0/22. The outage lasted about 2 hours. **Today** the /22 is originated by AS43515 and has ROAs, so the same /24 would be RPKI Invalid. Any RPKI defence in the 2008 scenario is a what-if.
- **ASNs:** PTCL 17557, TWA 38193, Cybernet/StormFiber 9541, Nayatel 23674, Multinet 9260, Wateen 38264, SCO 18053, PCCW 3491. Inter-AS relationships are inferred (CAIDA).
- **Model parameters:** fibre delay 5 µs/km × route factor **1.5** (Singla et al. 2014; a labelled assumption, set in `src/sim/params.js`).
- Internal ISP topology is **not public**. Corridors follow motorways and national highways, and the operator per corridor is illustrative. Say so in any presentation.

## What is real vs mocked right now
- **Real:**
  - the geography; the facts above; Dijkstra paths on the graph
  - **traffic** (step 3, `src/sim/engine.js` + `traffic.js`): a discrete-event simulation. Every directed link has a capacity, a propagation delay, a FIFO buffer and tail drop. Each moving dot is a 0.1 Gbit bundle. Parameters and sources are in `src/sim/params.js` and `docs/REFERENCES.md` §7.
  - **metrics**, all measured from that simulation: capacity, international throughput (busier direction), Karachi–Lahore RTT (probe bundles), loss on legitimate traffic, link and cable utilisation, router queue rings, link-load layer
  - attack traffic in the security scenarios (it really congests links)
  - **RIP** (step 4, `src/routing/dv.js`): distance vector in synchronous rounds, hop count, infinity 16, split horizon and poison reverse toggles. With protocol = RIP (Failures tab), traffic follows the routers' next hops, so loops (TTL drops) and black holes emerge; convergence is measured in rounds. One round = RIP's 30 s timer, compressed to `DV_ROUND_S`. The Route tab's Bellman-Ford view and the count-to-infinity demo (cut Nok Kundi–Taftan) read the real tables.
- **Mocked:**
  - OSPF and BGP convergence: still a timer per protocol, with stale-route drops during the window
  - under OSPF/BGP a bundle's path is fixed at injection (Dijkstra); hop-by-hop forwarding for those comes with steps 5–6
  - BGP: uses Dijkstra paths with only AS-path labels
  - security detection and response: timed scripts
- Debug hook: `window.__sim.tick(seconds)` advances the simulation without animation frames (useful when the browser pane is hidden).

## Roadmap (suggested order)
1. Give every edge a capacity (Gbps), a propagation delay (km × 5 µs × route factor 1.5, see `src/sim/params.js`) and a FIFO queue. Move packets as discrete events, with queueing delay and tail drop. Then derive the real metrics.
2. Write proper Bellman-Ford / distance-vector with timed update rounds, so count-to-infinity happens naturally. Add split horizon and poison reverse as options.
3. Link-state with flooding delay. Measure convergence time from the moment of failure.
4. Simplified BGP between ISP ASes: customer > peer > provider preference, valley-free export, AS-path length tie-break. Make the hijack scenario emerge from the BGP logic instead of a script.
5. Adaptive defence: anomaly detection on flows (rate, source entropy), RPKI-style origin validation, automatic reroute or scrubbing. Tie this to the instructor's adaptive-security work.
6. Optional: split `main.js` into modules (geo, graph, routing, sim, render, ui) once the simulation logic grows.

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
- UI: light cards, one side panel with 5 tabs (Overview, Route, Failures, Security, Metrics), a small playback pill, and a dock with Layers, Views and Legend pop-ups. Progressive disclosure, short copy.

## Facts used (verify before presenting; status as of late 2025)
- All of Pakistan's international submarine cables land in **Karachi**, a single point of failure. About nine have landed: SMW4, IMEWE, AAE-1, Africa-1 (PTCL); SMW5, TW1, SMW6, 2Africa (TWA); PEACE (Cybernet); SMW3 is retired. SMW3, SMW4 and IMEWE land at Hawke's Bay and AAE-1 at Clifton (submarinenetworks.com). SMW6 landed at Hawke's Bay in Nov 2025. Africa-1 and 2Africa had landed, but their capacity was pending as of late 2025.
- **Pak-China OFC (SCO):** about 820 km from Rawalpindi to Khunjerab. 26 microwave nodes between Rawalpindi and Karimabad act as backup, plus 171 km of aerial fibre from Karimabad to Khunjerab. Phase II plans extensions to Karachi and Gwadar, and a Gwadar landing station.
- **PKIX** exchanges: Islamabad, Karachi, Lahore.
- **PakSat-MM1:** geostationary at 38.2°E, launched May 2024, with gateway beams over Lahore, Karachi and Islamabad and 11 Ka-band spot beams.
- **AAE-1** fault near Qatar, Jan 2025: PTCL shifted its traffic to other cables.
- **2008 YouTube hijack:** AS17557 (PTCL) announced 208.65.153.0/24. It leaked through AS3491 (PCCW), and the outage lasted about 2 hours. YouTube is AS36561.
- Internal ISP topology is **not public**. Corridors follow motorways and national highways, and the operator per corridor is illustrative. Say so in any presentation.

## What is real vs mocked right now
- **Real:** the geography; the facts above; Dijkstra paths on the graph; stale-route packet drops during "convergence".
- **Mocked:**
  - throughput, latency, loss and convergence numbers (formulas plus noise)
  - convergence durations
  - Bellman-Ford and BGP: both use the same Dijkstra paths, with only different animations and AS-path labels
  - security scenarios: timed scripts
  - cable utilisation bars

## Roadmap (suggested order)
1. Give every edge a capacity (Gbps), a propagation delay (km × ~5 µs × route factor) and a FIFO queue. Move packets as discrete events, with queueing delay and tail drop. Then derive the real metrics.
2. Write proper Bellman-Ford / distance-vector with timed update rounds, so count-to-infinity happens naturally. Add split horizon and poison reverse as options.
3. Link-state with flooding delay. Measure convergence time from the moment of failure.
4. Simplified BGP between ISP ASes: customer > peer > provider preference, valley-free export, AS-path length tie-break. Make the hijack scenario emerge from the BGP logic instead of a script.
5. Adaptive defence: anomaly detection on flows (rate, source entropy), RPKI-style origin validation, automatic reroute or scrubbing. Tie this to the instructor's adaptive-security work.
6. Optional: split `main.js` into modules (geo, graph, routing, sim, render, ui) once the simulation logic grows.

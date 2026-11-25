# PAKNET redesign: "How Pakistan's internet travels"

Goal: make PAKNET feel like NASA's Eyes on the Solar System, but for Pakistan's internet. A realistic Earth seen from space, one continuous zoom from space to a city, real satellites, five interactive offices with a visual traceroute driven by the real simulator, a first-run tour, a presentation mode and one distinct animation per scenario. Layman-first; the engine and the numbers move to an "Expert" drawer and are never deleted.

This file holds the long design guidance. `CLAUDE.md` holds the short rules. `docs/HANDOFF.md` holds the state at the end of the last phase.

---

## 1. What exists today (Phase 0 exploration, Nov 2026)

- **Wiring.** `src/main.js` builds the basemap, topology, network drawing, labels and packets, creates the sim (`net`, `traffic`, `interdomain`), then the UI modules and scenarios through one `ctx` object. One `requestAnimationFrame` loop: camera → sim step (`stepWorld`) → `drawPackets` → fx → label bands → render (WebGL + CSS2D).
- **Projection.** `src/geo/projection.js`: a flat equirectangular plane centred on 69.3°E 30.2°N, x scaled by cos(30.2°). One unit ≈ 1° of latitude ≈ 111 km. `P(lon, lat, z)` and `unP(v)`. Every node `pos`, every edge `pts` and therefore every edge `len` (used by routing weights and propagation delay) is in these units.
- **Packets.** The engine moves bundles hop by hop. `traffic.place(b)` sets `b.path` (the geometry of the current hop, `buildPath(from, [edge])`) and `b.d` (distance along it). `render/packets.js` draws all visible bundles as one `THREE.Points` with a 4-point trail.
- **Render modules.** `scene.js` (renderer, OrbitControls, light, fat-line helpers, layer groups), `basemap.js` (green extruded province slabs), `network.js` (fat-line layers, router glyph meshes, city dots), `labels.js` (CSS2D labels by camera-distance band, story callouts), `fx.js` (bursts, route highlight, cut marks, shields), `heat.js` (link-load layer), `camera.js` (named views, fly-to, auto tour).
- **UI panels and KPIs (all in `src/template.html`).** Header card with brand and 5 KPIs (capacity `kCap`, throughput `kThr`, Karachi–Lahore RTT `kLat`, loss `kLoss`, cables `kCab`); toasts / notes / convergence toast; right icon rail (Overview, Route, Failures, Security, Metrics, Layers, Views, Legend, Hide); side panel with panes overview (traffic mix, story list), story, route (algorithm, source/destination, metric, trace, count-to-infinity demo), failures (scenario cards, cable list, protocol, detection), security (defence toggle, MAPE-K, compare, hijack/DDoS/malware, BGP table and clock), metrics (4 charts, link utilisation); bottom strip (play, speeds, time of day, clock, 3 trend sparklines, Stories); pop-ups (Layers, Views, Legend); first-run notice; About & sources dialog; tooltip; inspector card.

## 2. Library checks

| Library | Result | Decision |
|---|---|---|
| `3d-tiles-renderer` 0.5.4 | peer `three >= 0.167`; we are on 0.160 | **Not used.** Hand-rolled tile layer (Phase 1). No three.js upgrade needed. |
| `satellite.js` 7.2.0 | ESM; works in Node. esbuild fails on its optional WASM export (`node:worker_threads`). | Build aliases `satellite.js` to a shim that re-exports only `io.js`, `propagation.js`, `transforms.js`. Vitest uses the package directly. Checked: PakSat-MM1 snapshot propagates to 38.16°E, 35,793 km. |
| `playwright` 1.65.1 | headless Chromium installs on macOS | `npm run verify`. |
| `driver.js` | optional | **Not used**; the story engine is hand-rolled (it already exists in `src/stories/`). |

## 3. Architecture

```
src/
  geo/globe.js        NEW pure: latLonToEcef, ecefToLatLon, ecefToEnu, enuToLatLon, flatToLatLon, greatCircle
  sat/                NEW pure: catalog.js (groups, labels, licence status), propagate.js (satellite.js wrapper)
  sat/worker.js       NEW Web Worker: propagates all satellites at ≤ 5 Hz
  sim/offices.js      NEW pure: the 5 illustrative offices + getPath / getFlowsFrom / traceroute
  render/globe.js     NEW Earth: custom shader (day, night lights, terminator, ocean glint, atmosphere rim), stars
  render/tiles.js     NEW Sentinel-2 cloudless close-up tiles (EOX WMTS), capped, cached, disposed
  render/globecam.js  NEW camera controller: lat, lon, range, heading, tilt; eased fly-to; deep links
  render/satellites.js NEW one Points object + GEO ring + few LEO tracks + PakSat-MM1 footprint
  render/city.js      NEW city view: merged OSM buildings in a local ENU group (metres)
  render/labels.js    REWRITTEN label manager: distance bands, fade, ≤ 12, collision, horizon test
  render/network.js, packets.js, fx.js, heat.js   ADAPTED: flat → globe mapping at draw time
  ui/shell.js         NEW first screen, time bar, search, info card, layers, Expert drawer, credits
  ui/traceroute.js    NEW visual traceroute panel
  ui/tour.js, ui/present.js, ui/glossary.js        NEW (Phase 4)
  scenarios/anim.js   NEW scenario animations (Phase 5)
```

**The key decision: the simulation keeps its flat coordinates.** Routing weights and propagation delays come from edge lengths in the flat plane. Moving the topology itself onto the sphere would change every delay and every route, which the constraints forbid. Instead the *renderer* maps each flat point to the globe when it draws it: `flat (x, y, z) → (lon, lat) → ECEF km`. Every edge gets cached globe points `e.gpts` the first time it is drawn, so the mapping costs nothing per frame. Packets are sampled on the flat hop path and mapped with the same function (a few trig calls per dot).

Satellite edges are the exception: their flat geometry is a bezier to a fake point over Afghanistan. On the globe they are drawn from the ground station straight to PakSat-MM1's real propagated position, and dots on them are interpolated along that line by the fraction travelled.

## 4. Coordinate plan

- **Globe scene in kilometres.** Earth radius 6371 km, sphere (not ellipsoid). ECEF axes: +X towards 0°N 0°E, +Y towards 0°N 90°E, +Z north. `latLonToEcef(lat, lon, altKm)`.
- **City views in metres.** Each office's buildings are built in an East-North-Up frame centred on the office (x east, y north, z up, metres), inside a `Group` whose matrix holds the ECEF origin and ENU rotation (scale 0.001: metres → km). three.js multiplies matrices in double precision on the CPU and the vertices are small numbers, so there is **no float jitter** at 300 m. The group cross-fades in below ~25 km altitude. Functions: `ecefToEnu`, `enuToLatLon`, tested.
- **Lift.** Globe triangles are chords inside the sphere, so anything drawn at radius ≥ 6371 km is never hidden by the ground. The network group is scaled by `1 + lift/R` with `lift` growing with altitude (a few metres in city view, ~3 km from space) so lines never z-fight and never float visibly.
- **Depth.** Near and far planes follow the camera altitude (near ≈ 5 % of altitude, far = distance to the far side of the GEO ring). No logarithmic depth buffer (it would need every custom shader patched).
- **Camera.** A custom controller, not OrbitControls: target (lat, lon) on the surface, `range` (km from target, 0.3 km to 60,000 km, exponential wheel zoom), `heading`, `tilt` (forced towards 0 above ~3,000 km). Drag pans the target at a speed proportional to range, right-drag / two fingers rotate and tilt, pinch zooms. Fly-to interpolates lat/lon (shortest way), log(range), heading and tilt with ease-in-out over 1.5–3 s; any input interrupts it.

## 5. Assets (shipped in `dist/assets/`)

| Asset | Source | Size | Licence / credit |
|---|---|---|---|
| `earth-day-4k.jpg`, `earth-day-2k.jpg` | NASA Blue Marble Next Generation with topography and bathymetry (Reto Stöckli, NASA Earth Observatory); 4096×2048 file from the three-globe example mirror (jsDelivr), because visibleearth.nasa.gov downloads were unreachable | ~1.5 MB + ~0.5 MB | Public domain (NASA). Credit "NASA Blue Marble". No NASA logo, no implied endorsement. |
| `earth-night-4k.jpg`, `earth-night-2k.jpg` | NASA Black Marble 2016 (3 km), downloaded from assets.science.nasa.gov, resized | ~1.5 MB + ~0.5 MB | Public domain (NASA). Credit "NASA Black Marble". |
| Close-up tiles (streamed, not shipped) | EOX Sentinel-2 cloudless 2016 WMTS `s2cloudless_3857` | — | CC BY 4.0. Attribution: "Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)". Fails gracefully offline. |
| `src/data/satellites.json` | CelesTrak GP data (OMM JSON), fetched by `scripts/fetch-orbits.mjs` | < 400 KB | Credit "Orbital data: CelesTrak". |
| `src/data/cities/<city>.json` | OpenStreetMap buildings via the Overpass API, `scripts/fetch-buildings.mjs` | < 300 KB each | ODbL, "© OpenStreetMap contributors". |

Total shipped assets budget: ≤ 25 MB (expected ~6 MB).

## 6. Performance budget (checked every phase)

- Draw calls ≤ 100 in any view (`renderer.info.render.calls`). Satellites, packets and buildings are each one object.
- Pixel ratio `min(devicePixelRatio, 2)`; the dynamic quality fallback (Phase 6) drops to 1.
- Textures ≤ 4096 px; 2048 px on phones (`max(innerWidth, innerHeight) < 900` or touch).
- p50 ≤ 16.7 ms, p95 ≤ 20 ms on the Mac in Chrome at 1440×900; no frame > 100 ms during fly-to. Headless Chromium uses software rendering, so `npm run verify` frame times are a smoke test only; the user confirms with `?perf=1` in real Chrome.
- No per-frame allocations in hot loops (packets, labels, satellites reuse arrays and vectors).
- City views dispose their geometry and textures when left; `renderer.info.memory` returns to baseline.
- `?perf=1` shows fps, frame ms, draw calls, triangles and textures.

## 7. UI: what the layman sees vs the Expert drawer

First screen: dark space, the Earth turning with Pakistan coming into view, the title "PAKNET — How Pakistan's internet travels", one **Start** button, a small **Skip intro** link. Nothing else.

After Start: search box (top left), info card (right, when something is clicked), time bar (bottom: play/pause, 1×, 10×, 60×, 1 h/s, time of day, LIVE / Now), a small row of round buttons (Layers, Lighting, Help "?", Present, Expert), the credits line (always visible, small).

Moved into the **Expert** drawer (kept working, just hidden by default):

| Element | Why it's hidden |
|---|---|
| Header KPIs (capacity, throughput, RTT, loss, cables) | Numbers with units a layman can't read; plain-English versions appear in info cards and scenarios. |
| Icon rail + side panel (Overview, Route, Failures, Security, Metrics) | The engine's control room. Scenarios and the traceroute replace them for normal use. |
| Route tab algorithm picker, Bellman-Ford view, count-to-infinity controls | Course-level detail; the RIP scenario tells the same story visually. |
| Failures tab protocol/detection selectors, OSPF breakdown | Expert-only parameters. |
| Security tab MAPE-K table, BGP table, off-vs-on compare | Shown in plain words inside the DDoS / hijack scenario cards; full table in Expert. |
| Metrics tab charts, link utilisation, trend sparklines | Replaced by one before/after sentence per scenario. |
| Layers / Views / Legend pop-ups | Replaced by a short Layers menu (Network, Satellites near, Satellites far, "Coming soon" constellations, Pakistan's eyes in space, Navigation, Province borders, Clouds) and search. |
| Router glyph details, queue rings, link-load colours | Shown when Expert is on or a scenario needs them. |
| Old first-run notice | Replaced by Start + the tour. |

## 8. Phases and acceptance criteria

Every phase ends with the Verification Checklist (CLAUDE.md), one or more commits "phaseN: …", a push, and an updated `docs/HANDOFF.md`. (The user asked for all phases to run overnight without stopping between them.)

### Phase 1 — Realistic globe, space-to-city zoom, minimal first screen
- `src/geo/globe.js` with tested `latLonToEcef`, `ecefToEnu`, `enuToLatLon` (+ helpers).
- Globe shader: day texture, Black Marble lights blended across the terminator from the real sun direction for the current sim time, ocean glint, atmosphere rim; subtle starfield; Natural / Flood lighting.
- All network geometry drawn on the sphere; submarine cables continue as great-circle arcs to illustrative onward destinations (labelled "illustrative").
- Sentinel-2 tiles below ~1,500 km over Pakistan, visible area only, ≤ 6 concurrent requests, LRU cache, disposed when far, base texture fallback.
- Province borders as thin lines (toggle); slabs removed.
- First screen + time bar + search + info card + credits; old UI behind Expert. Deep links in the URL hash.
- **Acceptance:** first screen shows only globe, title, Start, Skip ☐; one continuous zoom from space to Karachi without pop, black frame or jitter ☐; packets visibly travel on the globe ☐; p95 ≤ 20 ms on the Mac (user check) ☐; all tests pass ☐; no console errors ☐.

### Phase 2 — Satellites near and far
- `scripts/fetch-orbits.mjs` → `src/data/satellites.json` (+ fetch date). Groups: PakSat-MM1 (59915), PakSat-1R (37779, greyed "retired Aug 2026"), Starlink / OneWeb / Kuiper / Qianfan (sampled ≤ 300 each, "sample of N"), Telesat (whatever is in orbit), PRSS-1 and PRSC satellites (optional "eyes in space"), GPS / BeiDou (optional, "navigation, not internet").
- Worker propagation at ≤ 5 Hz, interpolation on the main thread; optional live refresh ≤ once per 2 h with the snapshot as fallback.
- One Points object for all satellites, GEO ring, a few LEO tracks, PakSat-MM1 footprint ("approximate coverage"), ground links to the 3 gateways and VSAT terminals tied to the existing PakSat edges (dots really go up and down).
- Near / Far toggle with one plain sentence each; info cards with launch date, orbit, role for Pakistan, licence status, sources.
- **Acceptance:** PakSat-MM1 above 38.2°E on the equator (Vitest: snapshot longitude 38.2° ± 0.5°) ☐; "coming soon" visually distinct and labelled ☐; satellites add ≤ 3 draw calls ☐.

### Phase 3 — Offices with a visual traceroute
- 5 illustrative office hosts (Karachi, Lahore, Islamabad, Peshawar, Quetta) attached to the nearest router, traffic from the existing time-of-day generator. Read-only `getPath(src, dst)`, `getFlowsFrom(officeId)`, `traceroute(officeId, dest)`. Tests.
- City view (~1 km²) with OSM buildings baked by `scripts/fetch-buildings.mjs`, one merged mesh per city, office highlighted.
- Dots leave the office along the routing module's path; traceroute panel with numbered clickable hops, plain names, one-line jobs, measured delay; Expert shows hop id, queue and load.
- Destinations: "YouTube video", "WhatsApp message to Dubai", "Email to a friend in Lahore" (domestic via IXP), explained in plain words.
- **Acceptance:** clicking an office flies smoothly into the city ☐; traceroute hops equal the routing path (test) ☐; cutting a cable changes the office's path live ☐.

### Phase 4 — Tour, presentation mode, glossary
- Story-engine steps `{ camera, highlight, text, action }`; first-run tour (8 steps, skippable, replayable from "?").
- Presentation mode (P / button): full screen, arrows step, big captions, cursor hidden. Order: space → Pakistan → Karachi office traceroute → satellites → each scenario → defence loop.
- Glossary tooltips: packet, router, cable, IXP, BGP, latency (+ a few more).
- **Acceptance:** a first-time user can finish the tour and click an office ☐; every caption ≤ 25 words, grade 1–3 reading level (checked by a script) ☐; works at 390 px ☐.

### Phase 5 — Scenarios, one animation each
Cable cut (AAE-1 2025; Red Sea 2025 with 2–3 sequential cuts), KKH landslide, Gwadar what-if, DDoS, compromised phones, 2008 YouTube hijack, 2021 Facebook outage, RIP count-to-infinity, OSPF convergence. Each: 3-sentence kid explanation, one distinct visual, one before/after sentence from measured numbers, Expert details, "What did we learn?".
- **Acceptance:** each starts from one click, plays ≤ 45 s, can pause/step, ends with "What did we learn?" ☐; scenario logic tests pass ☐.

### Phase 6 — Cleanup, performance, final evidence
Dead code and cartoon styling removed (engine kept), bundle-size report, compressed assets, dynamic quality fallback (p95 > 25 ms for 3 s → pixel ratio 1, no clouds, smaller satellite sample), REFERENCES/README/report inputs updated, fresh-context review against this file, final screenshots.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Flat → globe mapping distorts the flat cable curves near the map edge | Flat geometry only covers ~25° around Pakistan; the inverse projection is exact there. |
| Float precision at 300 m | City geometry lives in a local ENU group (see §4). |
| EOX / CelesTrak / Overpass unreachable | Snapshot data ships in the repo; tiles are optional and fail quietly. |
| Headless Chromium is slow (software GL) | Treat its fps as a smoke test; user confirms with `?perf=1`. |
| Old UI modules assume the flat map (`n.pos`, view keys, `kit.focus` poses) | `flyTo` accepts view keys, flat poses and globe poses; fx/labels map flat positions internally. |
| Overnight work without review | One commit per step, pushed; `main` keeps the pre-redesign app. |

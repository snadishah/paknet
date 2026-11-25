# PAKNET — project context for Claude Code

## What this is
Computer Networks course project (SEECS, NUST), instructor **Ms. Maryam Sajjad** (adaptive security, mobile and network security). A three.js (v0.160) simulation of how Pakistan's internet traffic travels: cities, ISPs, exchanges, submarine cables, satellites, routing (RIP, OSPF, BGP), failures and an adaptive defence (MAPE-K).

**Direction (Nov 2026 redesign):** feel like NASA's *Eyes on the Solar System*, but for Pakistan's internet. A realistic Earth seen from space, one smooth zoom from space to a city, real satellites, five illustrative offices with a visual traceroute driven by the real simulator, a first-run tour and presentation mode, one distinct animation per scenario. **Layman-first**: the first screen is the Earth, a title and Start. Numbers and engine controls live in the **Expert** drawer; never delete the engine. Full design, phases, acceptance criteria and asset list: `docs/REDESIGN.md`. State of the last phase: `docs/HANDOFF.md`.

## Commands
- `npm install`, then `npm run build` → `dist/index.html` + `dist/assets/`. Serve it with `npm run preview` (http://localhost:4173); opening the file directly is not supported because textures and the worker load over HTTP.
- `npm run dev`: rebuild on save and serve `dist/` on http://localhost:5173 (also used by `.claude/launch.json`).
- `npm test` (Vitest, logic only). Use `npx vitest run --reporter=dot` for short output.
- `npm run verify`: build, serve, headless Chromium at 1440×900 and 390×844, screenshots + `.verify/report.json` (checks, p50/p95 frame ms, draw calls, console errors, dist size). Prints a 10-line summary. Headless uses software GL: frame times are a smoke test only.
- `npm run orbits` (CelesTrak → `src/data/satellites.json`), `npm run buildings` (Overpass → `src/data/cities/*.json`). Rarely needed; both keep the committed snapshot if offline.
- `npm run experiment`, `npm run report` (experiments, charts with Python/matplotlib, Word report → `docs/PAKNET-report.docx`).
- `npm run data`: regenerate `data/*.json` from the npm geo packages. Rarely needed.
- Dev machine is a **Mac**; keep scripts cross-platform (Node only, no bash-only or Windows-only commands).
- Debug hooks: `window.__sim.tick(seconds)`, `window.__paknetReady`, `window.__paknetStats`, `?perf=1` overlay.

## Layout
- `src/main.js` wires everything (one `ctx` object) and runs the frame loop.
- **Pure (no three.js, no DOM): `src/routing/`, `src/sim/`, `src/defence/`, `src/geo/globe.js`, `src/sat/` (except the worker glue).** They emit events (`src/events.js`); render and UI listen. Tested in Node (`tests/`).
- `graph/topology.js`: the graph in the **flat** map plane (`geo/projection.js`, 1 unit ≈ 111 km). Edge lengths drive routing weights and delays, so the topology stays flat; the **renderer maps flat → globe** at draw time (`geo/globe.js`). Never move the topology itself onto the sphere.
- `render/`: `scene.js` (renderer, layers, fat lines), `globe.js` (Earth shader, stars), `globecam.js` (camera, fly-to, deep links), `tiles.js` (Sentinel-2 close-ups), `network.js`, `packets.js`, `fx.js`, `heat.js`, `labels.js` (label manager), `satellites.js`, `city.js`.
- `ui/`: `shell.js` (first screen, time bar, search, info card, layers, credits, Expert drawer) plus the original Expert panels (`panel.js`, `route.js`, `failures.js`, `security.js`, `metrics.js`, `inspector.js`, `story.js`, `sources.js`) and the tour / presentation / traceroute modules.
- `scenarios/` orchestrate sim + render + UI; `stories/` are the guided stories (beats act on the live sim via `kit.js`).
- `src/template.html`: HTML + CSS. `scripts/build.mjs` bundles with esbuild and copies `assets/` into `dist/assets/`.
- `data/`: geo inputs (Natural Earth, provinces, GeoNames cities). `src/data/`: orbit and building snapshots.
- `archive/v1/`: the first neon version, reference only.

## Design rules (short; details in docs/REDESIGN.md)
- Realistic and calm: real day/night terminator, Black Marble city lights, thin atmosphere rim, subtle stars. **No neon, no bloom, no cartoon colours.** Thin elegant lines; small softly glowing dots.
- Packet colours: orange international, blue domestic, teal CDN, purple satellite; red only for cuts and attacks.
- Progressive disclosure: controls appear when useful; labels fade by distance, ≤ 12 on screen, never overlapping.
- Every camera move is an eased fly-to (1.5–3 s) the user can interrupt; zoom is continuous from ~40,000 km to ~300 m.
- Plain English everywhere outside Expert; captions ≤ 25 words; technical words get glossary tooltips.
- Accessibility: keyboard, visible focus, `prefers-reduced-motion`, text ≥ 14 px, works at 390×844 and 1440×900.
- Performance budget (every phase): ≤ 100 draw calls, p95 ≤ 20 ms on the Mac, textures ≤ 4096 px, assets ≤ 25 MB, no per-frame allocations in hot loops, dispose what you leave.

## Facts (source of truth: `docs/REFERENCES.md`; update it first)
Anything made up for teaching (offices, example servers, onward cable paths, operator per corridor) is labelled **"illustrative"** in the UI and in REFERENCES.md.
- All international submarine cables land in **Karachi** (single point of failure): SMW4, IMEWE, AAE-1, Africa-1 (PTCL); SMW5, TW1, SMW6, 2Africa (TWA); PEACE (Cybernet). SMW3 retired. Africa-1 landed, not in service; 2Africa service unconfirmed; SMW6 partial. App uses **13 Tbps lit (representative)**.
- **Pak-China OFC**: ~820 km Rawalpindi–Khunjerab, 26 microwave backup links, ~171 km aerial fibre Karimabad–Khunjerab.
- **IXPs**: PKIX Islamabad / Karachi / Lahore (activity unverified); PIE Karachi (DE-CIX + PTCL, 9 members).
- **Satellites**: only **PakSat-MM1** (GEO 38.2°E, NORAD 59915, launched 30 May 2024, operational 18 Sep 2024) carries Pakistani traffic. **PakSat-1R** (38°E, NORAD 37779) is greyed, "retired Aug 2026". Starlink, OneWeb, Amazon Kuiper/Leo, Shanghai Spacecom (Qianfan) and Telesat: "Coming soon — not yet licensed in Pakistan (as of late 2026)". PRSS-1 and PRSC satellites: optional "Pakistan's eyes in space" (pictures, not internet). GPS/BeiDou: "navigation, not internet".
- Incidents: AAE-1 fault near Qatar Jan 2025; Sep 2025 SMW4 + IMEWE cut near Jeddah; 20 Oct 2025 PEACE cut near Sudan; 2008 YouTube hijack (AS17557 → 208.65.153.0/24 via AS3491); 2021 Facebook withdrawal.
- Model parameter: fibre delay 5 µs/km × route factor 1.5 (`src/sim/params.js`). Internal ISP topology is not public; corridors are illustrative.
- Credits line (always visible): NASA Blue Marble / Black Marble (public domain; no NASA logo, no implied endorsement), Sentinel-2 cloudless by EOX (CC BY 4.0, 2016 layer), Orbital data: CelesTrak, © OpenStreetMap contributors (ODbL).

## Working rules
- Do not change routing/sim/defence behaviour. New data for the UI comes through small read-only APIs (e.g. `getPath`, `getFlowsFrom`) with tests.
- Never claim something works without evidence (test output, verify report, screenshots).
- One commit per completed step, message `phaseN: <what>`; push to `origin` (private GitHub repo `snadishah/paknet`, branch `redesign`). Never force-push or rewrite history.
- End of every phase: Verification Checklist (`docs/REDESIGN.md` §8: tests, build size, verify summary, screenshots looked at, acceptance ✅/❌, `git diff --stat`), commit, update `docs/HANDOFF.md` (≤ 30 lines).

## Token rules
- Never open `data/*.json`, `src/data/**/*.json`, `dist/`, `node_modules/`, lockfiles or the generated .docx. Grep first; read only the line ranges you need.
- Use subagents for broad exploration and reviews; they return short summaries.
- Edit in place with small diffs; don't rewrite a whole file to change a few lines; don't re-read unchanged files.
- Keep command output short (`--reporter=dot`, `| tail`). Read `.verify/report.json`, not raw logs; open screenshots only to check acceptance.
- If a library API is uncertain, check current docs once rather than trial and error.

# Handoff — round 2, Phase 1 (satellite view, roads, prominent Pakistan, no debug text)

**Done**
- Debug text removed from the UI (`#perf` overlay gone); `?perf=1` logs to the console only. Verify checks the page text for fps/stats words.
- `src/config/imagery.js`: all providers in one file (Esri World Imagery → MapTiler if `MAPTILER_KEY` → EOX Sentinel-2 → NASA). Keys from `.env` at build time (`scripts/build.mjs`), never committed or logged; `PAKNET_NO_KEYS=1` builds without them.
- `render/tiles.js` rewritten: generic tile layer (256/512 px), imagery + labels overlay, provider fail-over with fades, ≤ 8 requests, session cache, coarse tiles stretched until sharp ones fade in, draw cap 80 with the view's own sharp tiles first, soft feathered edge per level (no hard squares), visibility always a real boolean (three.js drew `undefined` ones), per-pixel day/night like the globe, gentle night "dusk" ramp, neighbour dimming.
- Esri labels: the build probes once; this key is refused (401/498), so the OSM road overlay is used (no browser errors). Switches automatically when the key allows it.
- Credits line follows the visible imagery: "Powered by Esri" + the service's `copyrightText`; EOX's exact text; OSM roads/buildings credits when shown.
- `scripts/roads.js` (`npm run roads`, cached raw download): OSM motorway/trunk/primary roads; 86/87 fibre corridors snapped to their road (`src/data/roads.json`, 665 KB, loaded at runtime); cables, route highlights and parcels follow the roads (render-only).
- Pakistan prominent: bright national border with glow and dark under-stroke (constant screen width), dimmed/desaturated neighbours (mask in `render/pakmask.js` used by globe + tiles), softer province lines, big "PAKISTAN" title fading 4,500 → 1,300 km.
- Loading indicator (`src/busy.js` + `#busy`): a small spinner pill bottom-left while imagery, buildings, 4k Earth photos or satellites load (spinner only on phones).
- verify: `--no-keys`, imagery provider seen, debug-text check, relative black-frame check, per-view draw calls and peak location, key redaction.

**Last verify (with key)**: draw calls max 106, 0 console errors, 10/10 scenarios, no black frame, no debug text. ❌ zoom smoothness 0.45 (limit 0.15): Esri's sharpest Karachi imagery is darker than the levels above it, so brightness swings ±10 while levels swap at 1–3 km (fix: match each tile's brightness to the tile it replaces, Phase 5).

**Known issues**: the ArcGIS key was printed once in the chat by an old verify version (never committed) — regenerate it. Khunjerab–China link still straight (Phase 2). Street level: buildings are still plain extrusions (Phase 3).

**Next**: Phase 2 (nothing ends abruptly).

**Files**: src/config/imagery.js, src/busy.js, src/render/{city,satellites}.js, src/render/{tiles,pakmask,globe,network,geo3,packets,fx,labels}.js, src/ui/shell.js, src/main.js, src/template.html, scripts/{build,verify,roads,fetch-roads,simplify-borders}.mjs/js, src/data/{roads,borders}.json, README.md, CLAUDE.md, docs/{REFERENCES,HANDOFF}.md.

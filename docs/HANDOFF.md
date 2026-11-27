# Handoff: round 2 complete (Phases 0–5, branch `redesign`, not merged into `main`)

**Done**
- **P1:** one imagery config (Esri → MapTiler → EOX → NASA, keys from `.env` at build time); feathered, brightness-matched tiles; OSM roads; Pakistan outline + dimmed neighbours; loading spinner; no debug text.
- **P2:** TeleGeography routes to Marseille, Toulon, Singapore, Hong Kong, Mombasa, Mumbai, Fujairah; border links to Kashgar, Kabul, Kandahar, Zahedan; couriers + arrival pulses; fades everywhere; blended flights, damped wheel/keys; paced tour and scenarios.
- **P3:** models in code (`render/models/`, `landmarks.js`): landing stations, IXPs, data centres, ground stations aimed at PakSat-MM1, exchanges, KKH towers, Khunjerab, offices with a live rack; procedural façades lit at night; PakSat-MM1 close up (DFH-4E) with the Earth behind.
- **P4:** Watch the story (`ui/watch.js`): 15 chapters (5 guided + 10 scenarios), captions, controls; plays to the end with no input.
- **P5:** fresh-context review and fixes (one mode at a time, clean verify shots, Expert-only rings, honesty tags, AAE-1 cut at Qatar, close-up clutter, phone bottom bar, text ≥ 12 px, jargon, labels avoid panels); README.

**Last verify** (27 Nov)
- **With key:** draw calls ≤ 131, 0 console errors, 10/10 scenarios, Watch 15/15, ready < 3 s, 5 MB. ❌ zoom smoothness 0.2 (limit 0.15) in the fast daylight zoom test.
- **No key (EOX): overall PASS.** Zoom 0.08, draw calls ≤ 122, 0 console errors, 10/10 scenarios, Watch 15/15, ready 2.5 s.

**Known issues**
- Regenerate the ArcGIS key (printed once by an old verify; never committed). It lacks Static Basemap Tiles, so the OSM road overlay is used.
- Without a key, imagery stops at ~10 m (EOX z15).
- Cut marks are still 2D.
- SEA-ME-WE 6 and 2Africa's Pakistan branch are approximate.
- Headless frame times are SwiftShader-bound; check on the Mac with `?perf=1`.

**Next**: your review; merge into `main` only when you say.

**Key files**: `src/config/imagery.js`, `src/render/{tiles,onward,landmarks,paksat3d,fade3d}.js`, `src/render/models/*`, `src/ui/{watch,fades}.js`, `scripts/{fetch-cables,fetch-roads,verify}.mjs`, `docs/REFERENCES.md` §9.

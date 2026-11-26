# Handoff — after Phase 3 (offices + visual traceroute)

**Done**
- `src/sim/offices.js` (pure): 5 illustrative offices added as host leaves behind their city router (`addOffices`, before `createNetwork`); read-only `getPath`, `pathTo`, `getFlowsFrom`, `traceroute`; office traffic = small real bundles (0.002 Gbit, 6/s per office at peak × time-of-day curve). Destinations: YouTube (W cable → "Google server — illustrative"), WhatsApp to Dubai (W cable), email to Lahore/Karachi (through the nearest IXP, stays in Pakistan).
- `scripts/fetch-buildings.mjs` (`npm run buildings [-- city]`) → `src/data/cities/*.json` (9–50 KB each; Quetta radius 900 m because OSM is sparse there). Copied to `dist/assets/cities/` and loaded only when you zoom in.
- `render/city.js`: one merged mesh per city + highlighted office building, ENU frame in metres (no jitter), fades in below 30 km, disposed above 70 km (verify: geometries 150 → 152 → 38).
- `ui/traceroute.js`: office cards ("Follow its traffic"), numbered clickable hops (plain names, jobs, delay measured on each link now; Expert: hop id, queue, load), destination chips, route + illustrative onward arc highlighted, "the road just changed" note when routing changes. Office dots are white.
- Slow motion near the ground (down to ×1/300, shown in the time bar) so 1 km hops are watchable; time of day unaffected.
- Hash links now also apply on `hashchange`.

**Evidence**: 89/89 tests (offices: attachment, routes between cities unchanged, hops == routing path, cable cut changes path, real flows). Verify PASS: 0 errors, max 81 draw calls, zoom smooth, city memory returns.

**Known issues**: office building = biggest OSM building within 120 m of the point (illustrative); the "measured" average needs a few delivered parcels before it shows.

**Next**: Phase 4 (tour, presentation mode, glossary).

**Files**: src/sim/offices.js, src/render/{city,network,packets}.js, src/ui/{traceroute,shell}.js, src/main.js, src/template.html, scripts/{fetch-buildings,build,verify}.mjs, src/data/cities/*, tests/offices.test.js.

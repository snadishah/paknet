# Handoff — after Phase 6 (cleanup, performance, review, evidence)

**Done in Phase 6**
- Dynamic quality fallback (`render/quality.js`): p95 > 25 ms for 3 s → pixel ratio 1, then every 3rd "coming soon" satellite; 8 s grace while the page loads; allocation-free.
- Bundle: `npm run size`; neighbour borders simplified (`scripts/simplify-borders.mjs`, 290 → 86 KB); satellites snapshot loaded at runtime. main.js 1.35 → ~0.92 MB; dist 4.26 MB; triangles 183k → 118k.
- Expert drawer in the dark theme (readable selects); OSM credit while buildings show; "not endorsed by NASA" visible on phones; README "How to use it"; REFERENCES §8.3 scenario notes; CLAUDE.md commands.
- Fresh-context review against REDESIGN.md: fixed Esc/Space in tour and presentation, traceroute highlight lost after unrelated cuts, keyboard focus lost on the 1 s traceroute refresh, satellites now ≤ 3 draw calls (GEO belt merged into the tracks), no slow motion during scenarios, landslide paused with the scenario, RIP restores split horizon / poison reverse, Gwadar button state, hijack before/worst/now metric, stale Play/Pause label, Flood from links, reduced motion stops the intro spin, phone tour vs traceroute overlap, pixel ratio after a quality drop, fly-to promises, Telesat searchable.
- `npm run experiment` still runs (the report only uses the simulator, unchanged).

**Evidence**: 153/153 tests; verify PASS (0 console errors, ready < 1.4 s, max 77 draw calls, zoom smooth 0.08, city memory returns, 10/10 scenarios end to end). Screenshots: `docs/evidence/*.jpg` (first screen, Pakistan, Karachi close-up, Karachi office traceroute, satellites far/near, three scenarios mid-animation, tour, presentation, Expert, phone layouts).

**Decisions / known limits**
- Satellite traffic (PakSat dots up and down) is on by default because the "Far satellites" layer is on; it is the original simulator's satellite traffic class, which the old app switched with its Satellite layer.
- Credits line is 11 px fine print (all other layman text ≥ 14 px).
- No unit tests for `ui/scenarios.js` (it drives the DOM); covered by verify's end-to-end check instead. Scenario logic in sim/routing/defence keeps its tests.
- A satellite deep link (`f=PAKSAT-MM1`) doesn't reopen the satellite card (the view itself is restored).
- Reduced motion: fly-tos are instant and the intro doesn't spin; packet dots and scenario effects still move (they are the content).
- Headless frame times are software rendering: **please confirm smoothness with `?perf=1` in real Chrome on the Mac.**
- Before the demo: `npm run orbits` (fresh satellite positions) and re-check cable statuses (REFERENCES §0).

**Files (Phase 6)**: src/render/{quality,satellites,fx,globecam,network}.js, src/ui/{shell,traceroute,scenarios}.js, src/main.js, src/template.html, src/palette.js, src/data/borders.json, scripts/{size,simplify-borders,verify}.mjs, README.md, CLAUDE.md, docs/{REFERENCES,HANDOFF}.md, docs/evidence/*.

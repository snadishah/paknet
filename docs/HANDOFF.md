# Handoff — after Phase 1 (globe, zoom, first screen)

**Done**
- Realistic globe (`render/globe.js`): Blue Marble day, Black Marble lights across the real terminator (sun from the sim clock), ocean glint, atmosphere rim + halo (fades below 2,500 km), stars. 2k textures first, 4k swapped in on desktops.
- Camera (`render/globecam.js`): lat/lon/range/heading/tilt, 300 m–60,000 km, drag/wheel/pinch/keys, interruptible eased fly-to with a "plane arc", intro spin that settles on Pakistan.
- Whole network on the sphere via `render/geo3.js` (flat → globe at draw time); onward cable arcs (illustrative); province borders as thin lines; slabs removed (`basemap.js` deleted).
- Sentinel-2 close-up tiles (`render/tiles.js`): ≤ 6 requests, cache 180, ≤ 48 drawn, coarse cover tiles so no holes, attribution shown only while visible.
- Shell (`ui/shell.js`): first screen (title, Start, Skip), search, info card (+ Expert details), time bar (1×/10×/60×/1 h/s, LIVE), layers menu, Natural/Flood, Expert drawer (old panels), deep links in the hash, `?perf=1`, credits line.
- Build: `dist/index.html` + `dist/assets/` (esbuild ESM); `npm run preview` (:4173). `dist/` no longer committed.

**Evidence**: 76/76 tests; dist 4 MB; verify PASS (0 console errors, max 72 draw calls, zoom space→300 m: no black frame, biggest sudden change 0.12).

**Decisions**: tiles hand-rolled (3d-tiles-renderer needs three ≥ 0.167); tiles drawn with depth test off + back-face culling; picking is screen-space; labels are a DOM layer (≤ 12, fade 300 ms, collision, horizon test).

**Known issues**: 300 m view is blurry until Phase 3 buildings (Sentinel-2 is 10 m/px); headless frame times are software GL — **please check `?perf=1` in real Chrome**.

**Next**: Phase 2 (satellites).

**Files**: src/main.js, src/geo/globe.js, src/render/{scene,globe,globecam,geo3,tiles,network,packets,fx,heat,labels,camera}.js, src/ui/{shell,inspector,metrics}.js, src/template.html, scripts/{build,verify}.mjs, assets/textures/*, tests/globe.test.js, README.md, docs/REFERENCES.md.

# Handoff — after Phase 2 (satellites near and far)

**Done**
- `scripts/fetch-orbits.mjs` (`npm run orbits`) → `src/data/satellites.json` (234 KB, fetched 2026-11-26): PakSat-MM1 + 1R, PRSS-1/PakTES-1A/PRSC (eyes), Starlink/OneWeb/Kuiper (sampled 300 each of 11,194 / 651 / 391), Qianfan 275, GPS 32, BeiDou 37; Telesat Lightspeed: none in orbit.
- `src/sat/` (pure): `catalog.js` (groups, honest roles and card text), `propagate.js` (satellite.js; null-safe), `worker.js` (SGP4 off the main thread, ≤ 5 Hz).
- `render/satellites.js`: one Points for all satellites (hollow rings = "coming soon", grey = retired), GEO belt ring, sample orbit tracks (one line object) → 3 draw calls; positions interpolated on the orbit each frame; PakSat-MM1 coverage disc ("approximate coverage", fades out below 9,000 km); PakSat network links and satellite packets now follow the propagated MM1 position.
- `ui/satui.js`: Layers → Satellites (Far / Near / Eyes in space / Navigation, one plain sentence each), search (PakSat-MM1, PakSat-1R, Starlink, …), click a satellite → card (launch, orbit, role, licence status; Expert: NORAD, COSPAR, epoch, live position).
- Tile streaming fixed: stale queued requests dropped, centre-first loading, coarse cover tiles, re-shown tiles fade; tile cap 50.

**Evidence**: 83/83 tests (PakSat-MM1 at 38.2° ± 0.5°, GEO height, stays put a week). Verify PASS: 0 console errors, max 71 draw calls, zoom smooth (biggest sudden change 0.12).

**Skipped / simplified**: no 3D models for PakSat (points only; LOD models were optional); no runtime orbit refresh (snapshot only — rerun `npm run orbits` before the demo).

**Next**: Phase 3 (offices + visual traceroute).

**Files**: src/sat/*, src/render/{satellites,network,labels,tiles,globecam}.js, src/ui/{satui,shell}.js, src/main.js, src/template.html, scripts/fetch-orbits.mjs, src/data/satellites.json, tests/satellites.test.js.

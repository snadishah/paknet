# Handoff — after Phase 0 (plan)

**Done**
- Explored the code; wrote `docs/REDESIGN.md` (architecture, coordinate plan, assets + licences, performance budget, acceptance criteria per phase, risks, Expert-drawer list).
- Rewrote `CLAUDE.md` (new NASA-Eyes direction, commands, purity + sourcing rules, token rules).
- `.claude/settings.json` denies reads of data JSON, dist, node_modules, .docx, lockfile.
- `scripts/verify.mjs` + `npm run verify` (Playwright, headless Chromium); `npm run preview` (port 4173).
- Installed `playwright` (dev), `satellite.js` 7.2.0; reinstalled node_modules for macOS (Windows copy wasn't executable).
- GitHub: private repo `snadishah/paknet`; `main` = pre-redesign app, work on `redesign`.

**Decisions**
- Topology stays in the flat plane (edge lengths drive delays); renderer maps flat → globe.
- No `3d-tiles-renderer` (needs three ≥ 0.167); hand-rolled tile layer.
- `satellite.js` bundled via a shim (its WASM export breaks esbuild).
- Day texture: NASA Blue Marble NG via the three-globe mirror (visibleearth downloads unreachable); night: NASA Black Marble 2016 direct.

**Known issues**
- The old app never sets `window.__paknetReady`, so `npm run verify` reports FAIL until Phase 1.

**Next step**: Phase 1 (globe, camera, first screen) — see `docs/REDESIGN.md` §8.

**Files touched**: CLAUDE.md, docs/REDESIGN.md, docs/HANDOFF.md, .claude/settings.json, .gitignore, package.json, package-lock.json, scripts/verify.mjs, scripts/serve.mjs.

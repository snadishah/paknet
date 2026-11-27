# Handoff: round 2 complete (Phases 0–5, branch `redesign`, not merged into `main`)

**Done**
- **P1:** one imagery config (Esri → MapTiler → EOX → NASA, keys from `.env` at build time); feathered, brightness-matched tiles; roads; Pakistan outline + dimmed neighbours; loading spinner; no debug text.
- **P2:** TeleGeography routes from Karachi to Marseille, Toulon, Singapore, Hong Kong, Mombasa, Mumbai and Fujairah. Border links run to Kashgar, Kabul, Kandahar and Zahedan. Parcels continue as couriers and pulse on arrival.
  - Fades: panels, cards, layers, scene effects, satellites, buildings.
  - Camera: velocity-blended flights, damped wheel and keys, reduced-motion fade.
  - Pacing: tours and scenarios wait for the camera.
- **P3:** models built in code (`render/models/`, `landmarks.js`):
  - landing stations facing the sea;
  - IXPs and data centres;
  - ground stations aimed at PakSat-MM1;
  - exchanges, KKH towers and the Khunjerab gate;
  - offices with a cut-away rack lit by live traffic.
  - Also: procedural façades, lit at night; PakSat-MM1 close up (DFH-4E) with the Earth behind.
- **P4:** Watch the story (`ui/watch.js`): 15 chapters (5 guided, then the 10 scenarios), captions, controls; it plays to the end with no input.
- **P5:**
  - A fresh-context review, and its fixes:
    - modes are exclusive and every verify shot starts clean;
    - OSPF rings are Expert-only;
    - honesty tags; AAE-1 cut at Qatar;
    - outline, satellite links and orbit ring fade close up;
    - phone bottom bar; text ≥ 12 px; jargon pass; labels avoid panels.
  - README covers key setup, Watch mode and credits.

**Last verify** (27 Nov):
- **With key:** draw calls ≤ 131, 0 console errors, no black frame, 10/10 scenarios, Watch 15/15 chapters, ready < 3 s, 5 MB. ❌ zoom smoothness 0.2 (limit 0.15) during the 150 ms/step synthetic zoom in daylight: Esri's levels still differ a little after brightness matching.
- **No key (EOX):** see the final summary in the Phase 5 commit.

**Known issues**
- The ArcGIS key was printed once in chat by an old verify (never committed): regenerate it. The key lacks Static Basemap Tiles, so the OSM road overlay is used.
- Without a key, imagery stops at about 10 m (EOX z15), so 300 m views are soft.
- Cut marks are still 2D (an X plus a glow).
- SEA-ME-WE 6 and 2Africa's Pakistan branch are approximate.
- Headless p95 frame time is SwiftShader-bound; check on the Mac with `?perf=1`.

**Next**: your review; merging into `main` only when you say.

**Key files**: `src/config/imagery.js`, `src/render/{tiles,onward,landmarks,paksat3d,fade3d}.js`, `src/render/models/*`, `src/ui/{watch,fades}.js`, `scripts/{fetch-cables,fetch-roads,verify}.mjs`, `docs/REFERENCES.md` §9.

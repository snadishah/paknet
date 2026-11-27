# Handoff: round 3 (branch `round3`, not merged into `main`)

**Done this round** (one commit each, `r3-1` … `r3-10` + fixes)
- **Destinations abroad:** rings from space (the old blocks were ~1,000 km wide); 3D landing stations / exchanges up close on Esri imagery (imagery now also loads ±2° around each).
- **PakSat-MM1 and PakSat-1R in 3D at every distance:** enlarged to ~64 px from afar ("shown enlarged"), true size up close; gold foil, solar-cell sheen; 1R weathered with folded wings; the close-up follows the satellite and hides map labels.
- **Offices:** a warm beam above each (0.5–200 km), labels down to the roof, plots clear of city blocks.
- **Speed:** destination tiles and buildings load during the flight; off-thread decoding; 0.6 s tile fade; quality steps back up. Sharp imagery 2.3 s after landing vs 4.9 s before (`scripts/sharpness-timing.mjs`). Real M1 at 1440×900 Retina: 60 fps.
- **Light:** filmic tone mapping for models; soft sun shadows below 3 km.
- **Scenarios in 3D:** ground rings, cut buoy / road barrier at the real fault (AAE-1's Gulf branch drawn to Qatar), fresnel DDoS shield, tumbling boulders, teal → amber → coral heat; labels avoid bubbles.
- **Up close:** fibre trench with marker posts, aerial poles; street life (trees, lamps, cars) on OSM streets (`npm run streets`); see-through Gwadar station.
- **Polish:** Inter shipped locally; 5 new tests (163 pass); README, REFERENCES §9.7; evidence in `docs/evidence/round3/`.

**Last verify** (27 Nov)
- **No key (EOX): overall PASS.** Zoom 0.09, draw calls ≤ 131, 0 errors, 10/10 scenarios, Watch 15/15, ready < 2.2 s.
- **With key:** all pass except zoom smoothness 0.21 (limit 0.15; round 2: 0.2): Esri's finest levels need near-maximum brightness correction at 2–3 km in the fast synthetic zoom.

**Not done / known**
- No real-sky (HDRI) reflections or ambient occlusion (a generated studio environment is used); other satellites (Starlink, etc.) stay dots.
- Frankfurt / US East destinations not added; SEA-ME-WE 6 and 2Africa's Pakistan branch approximate.
- Without a key, imagery stops at ~10 m (EOX z15). The Gwadar model sits at the planned node's position (may be just offshore).
- Headless frame times are SwiftShader-bound; check on the Mac with `?perf=1`.

**Next**: your review on http://localhost:4173 (`npm run preview`); merge `round3` into `main` only when you say.

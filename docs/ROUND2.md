# PAKNET round 2: beautiful, 3D, detailed and seamless

The rule this round is the **Quality Bar** (now in `CLAUDE.md`): everything 3D, everything detailed, everything continuous, everything clean, everything honest. This file holds the audit, the landmark and asset lists, and the plan with acceptance criteria per phase.

---

## 1. Imagery check (Phase 0, 26 Nov 2026)

Tiles fetched with `ARCGIS_KEY` from `.env` (never printed), zoom 17–19 at each place.

| Place | Zoom 17 | Zoom 18 | Zoom 19 | Highest zoom with real detail |
|---|---|---|---|---|
| Karachi (office, I.I. Chundrigar Rd area) | sharp: buildings, rail, cars | sharp: parked cars | sharp: car bays, trees | **19** |
| Lahore (Gulberg) | sharp | sharp | sharp: rooftop solar panels | **19** |
| Islamabad (Blue Area) | sharp | sharp | sharp: cars, tree crowns | **19** |
| Peshawar (Saddar) | sharp, dense old city | sharp | soft (upsampled) | **18** |
| Quetta (Jinnah Rd) | sharp | sharp | HTTP 404 (no tile) | **18** |
| Hawke's Bay (landing stations) | sharp: beach, plots | sharp | soft | **18** |

- **World Imagery works** with the key from any referrer (also with no `Referer` at all, so the referrer lock is not enforced for this service: **never publish a build that contains the key**).
- **The labels overlay fails.** `static-map-tiles-api…/arcgis/imagery/labels/static/tile/{z}/{y}/{x}` answers **HTTP 401 `{"error":{"code":498,"message":"Token Invalid."…}}`** for every referrer tried (`http://localhost:5173/`, `http://localhost:5173`, `http://localhost:4173/` — the key's actual referrer, per its settings page — and none). The same key works for World Imagery, so the key is valid but evidently **not authorised for the Static Basemap Tiles service**. To check in the ArcGIS developer dashboard: the key's *Privileges → Location services → Basemaps* (static basemap tiles) scope, or create a new key with that scope. Until then the plan uses our own overlay (roads baked from OSM + our place names), which looks the same and needs no key.
- **Referrer**: the key's settings page lists `http://localhost:4173` (the `npm run preview` port), not 5173 as in the brief. The app will run on either; adding `http://localhost:5173` to the key as well would cover `npm run dev`.
- **Credit text**: the service metadata (`copyrightText`) returns *"Source: Esri, Vantor, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community"* (Vantor is Maxar's new name). Per the brief, the app will show this returned text, with "Powered by Esri", while Esri tiles are visible.
- **Tile budget**: a 1440×900 view needs about 50 tiles per zoom level; a full zoom from space to a street touches ~12 levels → ~500–700 imagery tiles per visit (labels: a quarter of that at 512 px). 2 million tiles a month ≈ 3,000 full visits a day. Session-only memory cache, ≤ 8 requests at a time, visible tiles only.

---

## 2. Audit against the Quality Bar

Found by a fresh-context audit of the code and the current screenshots; the five problems you reported are all confirmed (marked ★). Each line: problem → fix (phase).

**Rule 1: everything 3D**
1. ★ Every place (routers, landing stations, IXPs, data centres, gateways, towers, offices) is a 3–11 px dot, ring or diamond, even up close → below ~50 km swap to instanced 3D models per kind (P3).
2. ★ PakSat-MM1 (tour step 5) and all satellites are dots → hero PakSat-MM1 model with LOD, low-poly instances for the rest (P3).
3. ★ The Karachi office is a flat orange extrusion → detailed office model (P3).
4. Cut "X" is an 18 px sprite → 3D broken cable ends + marker buoy (P2/P3).
5. Burst rings are huge screen sprites without depth test → ground rings sized in km, capped (P2).
6. DDoS shield is a flat green dome → PBR fresnel dome over the 3D scrubbing centre (P3).
7. Cut glow is a flat disc → glow along a 3D cable tube (P3).
8. Rocks and "confused parcels" are flat squares → instanced rock meshes; parcels drawn like packets (P2).
9. Cables/fibre are 1–2 px lines even at 300 m → world-unit tubes, trenches and poles below ~20 km (P3).
10. The ground is a smooth sphere (no terrain; Karakoram flat) → terrain elevation for close views where it matters (KKH) (P3, stretch).

**Rule 2: everything detailed**
11. No tone mapping, environment map or shadows → ACES/AgX, Poly Haven HDRI via PMREM, PCF soft shadows near the camera, AO (P3).
12. City buildings are grey Lambert extrusions with no UVs → PBR façades (window atlas), roofs with equipment (P3).
13. No ground detail in cities (roads, car parks, trees, lamp posts) → instanced from OSM (P3).
14. The 300 m view is a blurry smear (tiles capped at z15, one level coarse) → Esri z18–19 at street level (P1).
15. Buildings stay transparent after fading in (no shadows) → opaque once faded (P3).
16. Heat colours are flat green/yellow/red → muted teal → amber → coral (P5).
17. Bubble "flash" scales 1.25× (toy-like) → subtle opacity pulse (P5).

**Rule 3: everything continuous**
18. ★ Cables end in open sea at "Gulf · Red Sea · Europe", "India · Singapore", "East Africa" → real routes to real landing points from TeleGeography data, ending at 3D stations/data centres (P2).
19. The onward routes don't even touch the cables (240 km gap) and are faint → each cable continues from its own last point in the same style (P2).
20. ★ Tour step 7: the route highlight stops at the Gulf and the orange arc starts elsewhere → one continuous path, camera follows (P2).
21. Onward routes end at bare points (Marseille, Singapore…) → 3D landing station / data centre at each end (P2/P3).
22. Border links end in empty land ("Afghanistan", "Iran", "China") → continue to Kabul/Jalalabad, Zahedan, Kashgar with a 3D exchange (P2).
23. Malware "secret signal" lines end in the sea → end at an illustrative 3D server (P2).
24. Info card, tour card, captions, scenario card, traceroute panel, menus, search list, About all switch with no fade → 300 ms opacity/translate fades (P2).
25. Card text swapped instantly (tour, scenarios, traceroute every second) → cross-fade; update only changed rows (P2).
26. Bubbles appear/disappear instantly → fade in/out (P2).
27. Cut lines, X marks, shields, route highlight, onward arc, glow, `clearSceneFx` all instant → animate opacity on create and dispose (P2).
28. Layer toggles (heat, backbone dimming) instant → 400 ms tween (P2).
29. Whole network pops in on Start → 800 ms fade (P2).
30. Tiles pop out when leaving Pakistan's box / toggling → fade out (P1).
31. Satellites pop in on load/toggle; city buildings pop out when panning away → alpha fades before dispose (P2).
32. Some fades < 250 ms (notes 200 ms, tooltip 100 ms, glossary 150 ms) → ≥ 250 ms (P2).
33. Skip intro / search before Start jump the camera → eased flight (P2).
34. Deep links jump the camera → fly in (P2).
35. Reduced motion = 1 ms teleport → 400 ms fade through dark (P2).
36. Chained flights stop and restart (jolt) → new flight blends from current velocity (P2).
37. Wheel / keys zoom and pan in steps → damped spring toward a target (P2).
38. ★-related: parcels vanish mid-air at endpoints; drops burst only 30% of the time → always an arrival pulse at a 3D destination; explained drop effect (P2).
39. Tour steps overlap (enter() runs mid-flight) → wait for the flight/fade, then start the next step (P2).
40. Scenario "Next step"/Stop/Again are instant → minimum gap and fade-outs (P2).

**Rule 4: beautiful and clean**
41. ★ fps / frame / draw-call text bottom-left (`?perf=1` overlay) → removed from the UI entirely; verify measures on its own (P1).
42. ★ Pakistan's border is hard to see (1 px at 32% opacity) → bright national outline with soft glow, readable at every distance; darker, desaturated neighbours; thin province lines; big "PAKISTAN" label from space (P1).
43. "Slow motion ×1/300" → "Slowed down so you can watch" (P5).
44. "1 h/s" button unclear → "1 hour per second" tooltip / label (P5).
45. Jargon in layman text (Tbps, Gbps, "16 = no road", "+0.11 ms", STARLINK-1008, Tier III, DE-CIX, Cloudflare edge) → plain words; numbers in Expert (P5).
46. Unexplained effects: teal OSPF rings on every change, red rings at sinks, dashed PakSat streaks over Pakistan → only in Expert or in the story that explains them (P2).
47. Bubbles overlap labels; coverage label sits on the Earth → bubbles join the label collision pass (P5).
48. Monospace 12 px in traceroute, 10–11 px credits, Inter loads late (font swap) → Inter shipped locally, ≥ 12 px fine print (P5).
49. Phone: credits overlap the time bar, LIVE clipped → credits above the bar, compact buttons (P5).

**Rule 5: honest**
50. "Representative 3D model" appears nowhere; stations/IXPs/data centres are placed by offset from city centres → tags "representative 3D model" and "approximate location" in cards (P3).
51. The illustrative office paints a real OSM building orange; its label says just "Karachi office" → our own office model on its own plot, labelled "Illustrative office" (P3).
52. Cut marks sit in the wrong place (AAE-1 "near Qatar" drawn off Karachi) → place cuts at the real fault positions on the real routes (P2).

---

## 3. Landmarks and how each is built

Order of preference (the brief): (1) detailed hero model built in code or a properly licensed realistic model; (2) detailed procedural building. All get LOD (detailed up close, simple at mid distance, nothing far away) and a "representative 3D model" tag (offices: "illustrative").

| Landmark | Built as | Details up close |
|---|---|---|
| PakSat-MM1 (GEO 38.2°E) | **Hero model in code** (no licensed PakSat-MM1/DFH-4 model found, see §4) | box bus with gold MLI foil (normal-mapped crinkle), 2 long solar wings (cell grid), 2 large reflector dishes + feeds, Ka spot-beam antennas, thrusters, star trackers; sun-lit, Earth behind |
| PakSat-1R (retired) | same hero model, greyed, folded wings | — |
| TWA landing station, Hawke's Bay | **Hero model in code** | low secure building, fence + gate, guard hut, generators, fuel tank, beach manhole, cable trench to the sea, cables entering the water |
| PTCL landing station, Hawke's Bay | Hero (shares parts) | as above, different layout |
| PTCL Clifton / Sea View station | Hero (shares parts) | as above |
| Cybernet PEACE station | Hero (shares parts) | as above |
| Gwadar station (planned) | Hero, **ghosted** glass material, "what-if" badge | — |
| PKIX Islamabad, Karachi, Lahore; PIE Karachi | **Procedural data-centre building** | windowless façade, loading bay, rooftop chillers, generators, fuel tanks, fence, signage |
| TWA Tier III data centre; CDN edges | Procedural data centre (larger) | chillers, generator yard, fuel tanks, car park |
| Satellite ground stations (Karachi, Lahore, Islamabad) | **Hero dish model** + small building | 3 large dishes on pedestals, **aimed at PakSat-MM1** (computed az/el) |
| City core router sites | **Procedural telecom exchange** | 4–6 storey block, antenna mast with panels/dishes, cable vault |
| KKH microwave relay towers | **Hero lattice tower in code** (instanced) | steel lattice, 2–4 microwave dishes aimed along the chain, equipment shelter |
| Khunjerab Pass border crossing | Hero in code | gate arches, customs building, barrier, fibre hut |
| 5 offices | **Hero office model in code** (illustrative) | glass curtain wall, floors, lobby entrance, rooftop AC + antenna, car park with cars, trees, lamp posts, sign; cutaway network room with a blinking router rack |
| Surrounding city buildings | OSM footprints (baked, ≤ 300 KB/city) with **procedural façades and roofs** | window atlas by height, parapets, roof water tanks / AC units, merged per city |
| Onward destinations (Marseille, Frankfurt, Singapore, US, Dubai, Djibouti, Mombasa) | Procedural data centre + landing station (shared) | as above, at real landing points |
| Router racks (cutaways) | Hero rack in code (instanced) | status LEDs driven by the simulation (idle, busy, congested, down) |

---

## 4. Assets, sources and licences

Researched 26 Nov 2026. **Decision:** hero models are **built in code** (instanced, with LOD, PBR materials). That keeps the download small, needs no glTF pipeline for most objects, and has no licence risk. Licensed assets are used only for what code can't make well: textures, lighting and two reference models.

| Asset | Source | Licence | Size | Use |
|---|---|---|---|---|
| Daytime HDRI `wide_street_01` (or `potsdamer_platz`, overcast) | polyhaven.com/a/wide_street_01 | CC0 (credit optional; we credit) | 1k .hdr 1.5 MB | city lighting and reflections (PMREM) |
| Studio HDRI `studio_kontrast_04` | polyhaven.com/a/studio_kontrast_04 | CC0 | 1k 1.5 MB | satellite reflections (background stays black space) |
| Concrete, asphalt, corrugated steel, brick, glass façade | ambientCG Concrete034, Asphalt031, CorrugatedSteel009, Bricks105, Facade001/006/018A; Poly Haven concrete_wall_008 | CC0 | 1k, ~2–4 MB each before compression → WebP/KTX2 ~0.3–0.6 MB each | PBR materials on buildings, ground, props |
| NASA Deep Space Network 34 m dish (reference) | science.nasa.gov/3d-resources/deep-space-network-34-meter | NASA, free / no copyright; credit NASA, no logo or endorsement | GLB 2.9 MB, 32k tris → meshopt ~0.8 MB | optional: one hero dish for ground stations (or built in code) |
| NASA SSL-1300 GEO comsat (reference) | science.nasa.gov/3d-resources/space-systems-loral-ssl-1300 | NASA, free / no copyright; credit "NASA/Christopher R. Meaney" | GLB 0.5 MB, 182k tris | **reference only**: PakSat-MM1 is a DFH-4 bus, not SSL-1300, so the hero satellite is built in code to DFH-4 proportions and labelled "representative 3D model" |
| Inter font (shipped locally) | rsms.me/inter | SIL Open Font Licence 1.1 | ~100 KB woff2 | one font, no late swap |
| Roads | OpenStreetMap via Overpass (`fetch-roads.mjs`) | ODbL, "© OpenStreetMap contributors" | target ≤ 600 KB baked | cables along real roads |
| Buildings (existing) | OpenStreetMap | ODbL | ≤ 300 KB per city | city footprints |
| Submarine cable routes | TeleGeography (see below) | **needs your decision** | 756 KB geo + 362 KB landing points (raw) → ~150 KB baked for Pakistan's 9 cables | real routes to real landing points |
| Esri World Imagery + labels | ArcGIS Location Platform (your key) | Esri terms: "Powered by Esri" + data attribution always visible, fetched at runtime | streamed | close-up imagery |
| EOX Sentinel-2 cloudless (fallback) | s2maps.eu | CC BY 4.0 (2016 layer) | streamed | fallback imagery |
| NASA Blue/Black Marble (existing) | NASA | public domain | 3 MB | globe from space |

**Not used, and why:** Poly Haven photoscan trees (up to 215 MB each) are too heavy, so trees are built in code with instancing. Poly Haven fence, aircon and generator (2–7 MB each) are cheaper to build in code. Sketchfab CC BY models (lattice tower, diesel generator, HVAC, cars, palms) need a Sketchfab login to download and add a credit each, so code-built versions are used instead (and they can be added later if you want). Kenney and Quaternius are cartoon-style, so they break the Quality Bar.

**TeleGeography cable data: please choose.** The old public repo (archived 2022) was licensed **CC BY-NC-SA 3.0**: fine for a non-commercial student project, with credit "Submarine cable data © TeleGeography, submarinecablemap.com, CC BY-NC-SA 3.0", and our derived file under the same licence. The live API still answers without a key, but TeleGeography's current terms say only the *maps* are CC BY-SA 4.0 and *"access to the underlying databases remains restricted to paying subscribers"*. Options:
- **(a) recommended:** use the archived 2022 CC BY-NC-SA 3.0 data for the 9 Pakistan cables (routes rarely change; SMW6/2Africa/Africa-1 may be missing or partial, so those get hand-traced approximate routes labelled "approximate");
- (b) hand-trace all routes from public descriptions, labelled "approximate route";
- (c) email cablemap@telegeography.com for permission to use the live data.

**Compression pipeline** (only if a glTF is used): `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp --texture-size 1024`; three.js r160 loads it with `GLTFLoader` + `MeshoptDecoder` (WebP needs no extra loader). KTX2 needs the `ktx` CLI (KTX-Software ≥ 4.4) and `KTX2Loader` with the basis transcoder copied locally.

**Budget:** new shipped assets ≈ 6–9 MB (2 HDRIs, ~8 compressed texture sets, font, baked roads/cables); total dist stays well under 25 MB.

---

## 5. Plan and acceptance criteria

Every phase ends with `npm test`, `npm run build`, `npm run verify` (1440×900 + 390×844), looking at the screenshots, a ✅/❌ check of each Quality Bar rule with evidence, a commit `r2-phaseN: …`, `docs/HANDOFF.md`, and a stop for your go-ahead.

### Phase 1: satellite view with roads, a prominent Pakistan, no debug text
- `src/config/imagery.js`: one file with every provider (Esri World Imagery + Esri labels, MapTiler if `MAPTILER_KEY`, EOX Sentinel-2, NASA). Keys injected at build time from `.env` by `scripts/build.mjs` (`define`), never committed; no key → keyless fallbacks.
- Tile engine: handles 256 px (imagery) and 512 px (labels) tiles; a labels layer above imagery; lower zoom stretched until the sharper tile arrives (no blank or grey squares); ≤ 8 concurrent; session cache; fade-in; cross-fade from the NASA globe driven by camera height around 1,500 km (~1.5 s worth of zoom).
- Provider fallback chain with smooth fades and no on-screen errors: Esri → MapTiler → EOX → NASA. Credits line switches with the visible provider ("Powered by Esri" + the service's `copyrightText`; labels credit; or EOX / NASA).
- If the Esri labels stay unavailable: our own label overlay (OSM roads from `fetch-roads` + our place names) so the hybrid look holds.
- `scripts/fetch-roads.mjs`: OSM route relations M-1…M-16, N-5, N-25, N-35, N-40, N-50, N-55, N-65, N-70, N-10, N-85 … (all present in OSM), simplified, baked to `src/data/roads.json`. Each fibre corridor is matched to its road (table in the script); cables draw along the road and parcels move along it (render-only: the simulator's lengths and delays are unchanged).
- Pakistan prominent: bright national outline + soft glow (width constant on screen), darkened/desaturated neighbours (shader mask), softer province lines, large "PAKISTAN" label from space fading out as you zoom in.
- Remove the `?perf` overlay and all stats text from the UI.
- **Acceptance:** space → Karachi street is one continuous zoom (verify brightness probe + screenshots at each stage); roads visible and matching the cables; outline obvious at every zoom; no debug text (grep + screenshots); works with no key (verify run with keys hidden); credits correct per provider.

### Phase 2: nothing ends abruptly
- Real cable routes from TeleGeography (licence permitting, see §4) baked by `scripts/fetch-cables.mjs`, each cable continuing to its real landing points; destinations are 3D landing stations / data centres (Marseille, Frankfurt, Singapore, US East, Dubai…), chosen by the service a parcel is going to. Parcels travel the whole way (render-side continuation of the simulated hop, timed by real propagation delay); the camera can follow them across the globe.
- Border links continue to Kabul/Jalalabad, Zahedan, Kashgar.
- Fades everywhere (items 24–32), eased camera chaining with velocity blending and a damped spring for wheel/keys (33–37), arrival pulses and explained drops (38), tour/story steps that wait for the previous animation (39–40).
- **Acceptance:** tutorial step 7 continues smoothly past the Gulf to a real destination (screenshot sequence); no path ends in empty space (automated check: every drawn line ends at a 3D object); every transition eased and faded; each fixed audit item listed with a screenshot.

### Phase 3: 3D buildings and satellites with real detail (in groups, one commit each)
- Rendering: `MeshStandardMaterial`/`MeshPhysicalMaterial`, Poly Haven HDRI (PMREM), ACES or AgX tone mapping, PCF soft shadows near the camera, subtle AO; LOD for every model; instanced/merged geometry; compressed textures; dispose on leaving.
- Group A **Karachi**: Hawke's Bay and Sea View/Clifton landing stations, PEACE station, PKIX + PIE Karachi, TWA data centre, Cloudflare edge, Karachi ground station, Karachi core exchange, Karachi office with cutaway network room.
- Group B **other cities**: Lahore, Islamabad, Peshawar, Quetta landmarks and offices; OSM façades/roofs; Gwadar (ghosted).
- Group C **satellite + KKH**: PakSat-MM1 hero model and the NASA-Eyes-style fly-up/orbit/inspect; lattice relay towers; Khunjerab Pass.
- Router cutaways with LED racks reacting to the simulation.
- **Acceptance:** close-up and mid-distance screenshots of every landmark look realistic; the satellite close-up looks like NASA Eyes; a full city view stays ≤ ~150 draw calls.

### Phase 4: presentations that play themselves
- "Watch" mode: a film-like player (chapters: Earth → Pakistan; a parcel from the Karachi office to a YouTube server abroad and back; WhatsApp to Dubai; Islamabad → Lahore email via PKIX; satellites; each scenario). The followed parcel is a real simulator flow on its real path; the camera follows; captions fade in grade-1 language; the traceroute fills in hop by hop. Controls: play/pause, previous/next, 0.5×/1×/2×, chapter list; any click pauses, "Resume" continues. First screen: "Watch the story" next to "Explore". P key uses this player.
- **Acceptance:** one press of "Watch the story" plays every chapter to the end with no input (verify runs it); no abrupt moments.

### Phase 5: UI polish and final check
- Restyle every panel, button, card and caption to the Quality Bar (dark glass, spacing, one font shipped locally, hover/press states) at 1440×900 and 390×844; jargon out of layman text (items 43–49).
- Fresh-context walkthrough against the Quality Bar and all acceptance criteria; fix findings. README (ARCGIS_KEY setup, run, credits), REFERENCES.
- **Final evidence:** test/build output, verify summary, screenshots of the space view, the imagery switch, roads, the Karachi office cutaway, Hawke's Bay, the satellite close-up, step 7 past the Gulf, Watch mode mid-chapter, the phone layout.

### Performance budget (every phase)
≤ ~150 draw calls in any view; LOD everywhere; instanced/merged geometry; glTF (if any) compressed with gltf-transform (meshopt + WebP/KTX2); textures ≤ 2K for props; dispose on leaving a view; smooth on the MacBook in Chrome (checked by you with the dev-only perf readout in the console).

# Handoff — after Phase 5 (scenarios, each with its own animation)

**Done**
- `ui/scenarios.js`: 10 scenarios started from one click ("What can go wrong?" button, search, presentation slides): AAE-1 cut, Red Sea cuts (3 in sequence, camera on the Red Sea), KKH landslide, Gwadar what-if ("Imaginary scenario" badge), DDoS, compromised phones, 2008 YouTube hijack, 2021 Facebook outage, RIP count-to-infinity, OSPF convergence. Each: ≤ 42 s, Pause / Next step / Start again / Done, the 3 kid sentences appear as it plays, one measured before/after sentence, Expert details, ends with "What did we learn?". All world changes go through the simulator (cuts, BGP actions, attacks, protocols).
- `render/scenefx.js`: sparks, red glow, self-drawing cable, sliding rocks, ripple waves, fading roads, circling "confused" parcels, secret-signal lines, phones lighting up, pinned bubbles (alarm bell, RPKI stamp, step counters, stopwatch). Attack dots are grey in the DDoS story.
- Draw calls kept flat: all bursts are one Points object; all cut lines one object; all cut X marks one Points object; scenario lines merged.
- verify: new end-to-end check runs all 10 scenarios to "What did we learn?" (10/10).

**Decisions**: the scenario story clock follows wall time (capped 0.25 s/frame) so it isn't slowed by slow frames; the simulation itself still follows the time bar / slow motion.

**Known issues**: hijack "share of the world" comes from the simplified 15-AS BGP model (can read 100%); Red Sea cut points are drawn on the illustrative onward route.

**Next**: Phase 6 (cleanup, dynamic quality fallback, references/README, fresh review, final evidence).

**Files**: src/ui/scenarios.js, src/render/{scenefx,fx,labels,packets}.js, src/main.js, src/template.html, scripts/verify.mjs.

**Phase 6 started (in this commit, not yet fully verified):** dynamic quality fallback (`render/quality.js`: p95 > 25 ms for 3 s → pixel ratio 1, then every 3rd "coming soon" satellite; 8 s grace at load), neighbour borders simplified (`scripts/simplify-borders.mjs` → `src/data/borders.json`, 290 → 86 KB), `npm run size` bundle report, OSM credit shown while buildings are on screen, Expert drawer recoloured to the dark theme, README "How to use it", REFERENCES §8.3 scenario notes. **Still to do:** run `npm test && npm run verify` on this state and look at `mac-expert.png`; act on the fresh-context review; final evidence pack; final HANDOFF.

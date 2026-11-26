# Handoff — after Phase 4 (tour, presentation, glossary)

**Done**
- `src/stories/captions.js` (pure): the 8 tour captions + presentation captions; `src/stories/kids.js`: what / why bad / how it heals / what we learned for all 10 scenarios (used in Phase 5). `tests/captions.test.js`: every caption ≤ 25 words and Flesch–Kincaid grade ≤ 3 (on-screen taught words such as "internet", "satellite", "YouTube" count as one syllable; titles: ≤ 8 words).
- `ui/tour.js`: hand-rolled story engine (steps = camera + enter/leave + caption). Start → 8-step tour (Back/Next/Skip, ← → Esc, focus on Next), "?" replays, the last step pulses the offices and ends when one is clicked. Presentation mode (P or the screen button): full screen, big caption bar, cursor hidden, ← → / PageUp / PageDown / space, Esc leaves; order space → Pakistan → Karachi office traceroute → satellites → [scenario slides, Phase 5] → defence loop card.
- `ui/glossary.js`: tooltips (hover, focus, tap) for packet, router, cable, IXP, BGP, latency, satellite, DNS, RPKI, DDoS, botnet, OSPF, RIP … in tour captions, info cards and the traceroute.
- Satellite snapshot now loads at runtime (`assets/satellites.json`): bundle 1.35 → 1.12 MB.
- Offline: the tile loader backs off for 30 s after a failure (one failed request, not dozens); verify counts optional-internet failures separately and does one warm-up load.

**Evidence**: 153/153 tests. Verify PASS: 0 console errors, ready 0.64 s (warm), max 81 draw calls, zoom smooth (0.07), city memory returns.

**Next**: Phase 5 (scenarios with their own animations; they register presentation slides via `ctx.scenarioSlides`).

**Files**: src/stories/{captions,kids}.js, src/ui/{tour,glossary,shell,traceroute,satui}.js, src/render/{satellites,tiles}.js, src/main.js, src/template.html, scripts/{build,verify}.mjs, tests/captions.test.js.

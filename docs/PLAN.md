# PAKNET implementation plan

Goal: turn the visual proof of concept into a real simulation, tidy the frontend and produce the presentation material. Deadline is 2–4 weeks, so every item is in scope; BGP and adaptive defence are built to moderate depth.

Decisions already made with you:
- Split `main.js` into modules **first** (step 1), not last.
- The frontend problems are **overlapping UI** and **wrong behaviour** (no console errors were found).
- Design refresh: **2–3 mockups first**, you pick one, then I apply it.
- The report is a **Word (.docx)** file.
- **git**, local only, with one commit per verified step.
- **Vitest** for the simulation and routing logic.
- Scenarios become **guided stories** (step 8): a full presentation of each incident, driven by the real simulation, not small alert text.
- **More scenarios**, chosen from a verified list of real incidents (step 8).
- Every fact and design decision gets researched against primary sources and recorded in **`docs/REFERENCES.md`**. The final report is built from that document (step R and step 10).

Every step ends the same way: tests pass → `npm run build` → check the page in the browser at desktop width and at 375 px → the console is clean → commit.

---

## What I found in the current build

On load and across every scenario the console stays clean. These problems are what you'd see on screen:

| Problem | Where |
|---|---|
| The KPI bar covers the brand card ("proof of concep…" is cut off at 1440 px) | `#kpis` uses a fixed `left: calc(50% - 180px)` |
| The dock (Layers / Views / Legend) overlaps the playback pill below about 1000 px | `#dock` and `#player` are both fixed to the bottom |
| The convergence toast sits on top of the KPI bar | `#conv` at `top: 122px` |
| "Restore everything" leaves the Gwadar what-if on | `restoreAll()` never resets `plannedActive` |
| The route highlight lingers and the trace's `setTimeout` packets keep firing | `clearHighlight()` only runs on a new trace or a cut; geometries are never disposed |
| The satellite renders as a flat bar floating over Afghanistan | the satellite model and its position |
| The China pill sits over the Gilgit-Baltistan label | label offsets |
| Metric numbers are formulas plus noise and don't add up (throughput can exceed what the cables carry) | `setInterval` in the metrics section |
| No layout at all for small screens | the CSS has only 1180/900 px breakpoints |

---

## Core design: one simulation drives both the dots and the numbers

This is the central idea. Today each packet is an animation along a precomputed path, and the numbers are invented. After the change:

- **Two clocks.** *Network time* (milliseconds) runs in slow motion, about 1 wall-second to a few ms of network time at 1×, so a Karachi→Lahore crossing still takes about 1.5 s on screen. *Time of day* (the 21:00 slider) stays separate and only sets how much traffic is offered.
- **Each dot is a bundle of traffic** (a fixed volume, for example 0.5 Gbit), not one IP packet. Simulating Tbps packet by packet is impossible in a browser. The KPIs scale the bundles back up to Tbps. The UI and the report both say this.
- **Discrete-event engine.** A heap-ordered event queue handles arrive-at-router, finish-transmission and drop events. Each directed link has a capacity (Gbps), a delay (`km × 5 µs × 1.5`; route factor 1.5 from Singla et al. 2014, a labelled assumption in `src/sim/params.js`), a FIFO buffer sized from its bandwidth-delay product, and tail drop.
- **Hop-by-hop forwarding.** Each router has a forwarding table written by the active protocol (OSPF, distance-vector or BGP). Packets look up their next hop at every router; there are no precomputed paths. So during convergence, packets *really* follow stale or inconsistent tables. Loops, TTL expiry and black holes come out of the model on their own, with no script.
- **Access cities are hosts behind their parent router** (like prefixes). Routing runs among about 110 routers and infrastructure nodes, not all 500 places. The 26 microwave relays collapse into one logical link for routing purposes, otherwise RIP's 15-hop limit would be crossed on that chain alone.
- **Seeded random numbers**, so a scenario replays identically. The defence before/after comparison depends on this.
- **The same modules run headless in Node** (`scripts/experiment.mjs`), which produces the CSVs and charts for the report.

Module layout (step 1):

```
src/
  geo/        projection, basemap data
  graph/      nodes, edges, topology builder, capacities
  sim/        event queue, links, queues, traffic generator, metrics   ← no three.js
  routing/    dijkstra, ospf, distance-vector, bgp, rpki               ← no three.js
  defence/    detectors, MAPE-K controller                             ← no three.js
  render/     scene, layers, packets, fx, labels
  ui/         panel, tabs, KPIs, dock, inspector, mobile sheet
  main.js     wiring only
```

The `sim/`, `routing/` and `defence/` folders never import three.js or the DOM. That keeps them testable with Vitest and runnable headless.

---

## Steps

### 0 · Setup (short)
- `git init`, then commit the current state as the baseline.
- `npm install`, add Vitest, add `npm test`.
- Add `scripts/serve.mjs` (a static server with no dependencies) and point `.claude/launch.json` at it, replacing the temporary one I made today.
- **Check:** the build output matches the current `dist/index.html` behaviour.

### 1 · Split `main.js` into modules (no behaviour change)
- Move the code into the folders above. Pure refactor.
- Replace the globals (`epoch`, `cache`, `staleSet` …) with an explicit `state` object passed between modules.
- **Check:** before/after screenshots match at the same camera view, all scenarios still run, console clean.

### 2 · Design refresh + frontend fixes
1. **Mockups (done).** Three variants in `prototype/ui-mockups/`: A refined, B status strip, C left rail. **Decision:** desktop uses B with A's floating header (brand + KPIs) and A's notification stack; the bottom strip keeps playback, trend charts and Stories. Desktop story mode uses B's narrative column. Phone uses B in normal mode and C's lower third with the dated timeline in story mode. Recorded in CLAUDE.md under Design direction.
2. **Apply it:** an 8 px spacing grid, a type scale, consistent SVG icons in place of the ✂ ⚑ ≋ glyphs, toasts moved to a single notification stack that never covers the KPIs, and a "Clear" button on the route result.
3. **Fix the behaviour bugs:** Restore resets every what-if; the route highlight clears on a new trace, a tab change, a topology change and Restore, with pending trace timers cancelled and geometries disposed; label collisions; a proper satellite model and position.
4. **Small screens (<768 px):** the panel becomes a bottom sheet with tabs and a drag handle; KPIs become 2–3 chips you can scroll sideways; the dock shows icons only; tap targets are at least 44 px; the shadow map is smaller and the pixel ratio capped for performance.
- **Check:** desktop at 1440 and 1024 px, tablet at 768 px, phone at 375 px. No overlaps.

### 3 · Real traffic simulation (your item 1) — done
**Done (Nov 2026):** `src/sim/engine.js` (event queue, links, FIFO, tail drop) and `src/sim/traffic.js` (generator, probes, measurement); parameters in `src/sim/params.js`, sources in REFERENCES §7; 14 engine and traffic tests. Two things the simulation exposed and that were fixed: the Karachi → Hyderabad corridor was the national bottleneck until fibre capacity scaled with the number of operators, and a share bug sent 4% of traffic to the land borders. Remaining from this step: a bundle's path is fixed at injection; hop-by-hop forwarding arrives with steps 4–6.
- Capacities by edge type, e.g. subsea per cable, trunk fibre, regional fibre, microwave, satellite. These are **representative values**, listed in an assumptions table that appears in the UI and the report.
- Traffic generator: a gravity model on population for domestic traffic, plus international, CDN, satellite and border flows. Volume scales with time of day.
- Measured metrics replace the formulas: throughput = bundles delivered per second; latency = real end-to-end time of Karachi→Lahore probe bundles (propagation + queueing); loss = tail drops ÷ offered; cable utilisation = busy time ÷ window; the queue rings and the link-load layer read the real buffers.
- **Tests:** one link at 2× its capacity drops about 50%; latency on an idle path equals its propagation delay; FIFO order is preserved.
- **Check:** cutting AAE-1 at peak hour produces real congestion and loss on the remaining cables. That loss is measured, not scripted.

### 4 · Real distance-vector / Bellman-Ford (your item 2) — done
**Done (Nov 2026):** `src/routing/dv.js`; RIP drives forwarding when chosen as the routing protocol; split horizon and poison reverse toggles; count-to-infinity demo on Nok Kundi–Taftan; convergence measured in rounds; 8 new tests. What the simulation showed: without split horizon the routers count 3 → 15 → 16 over 14 rounds; with split horizon or poison reverse the two-router bounce stops at once, but a stale route still circles the larger Balochistan loop and counts up before dying (split horizon's known limit for loops of 3+ routers). Looping traffic jams the Nushki–Kharan microwave link before its TTL runs out.
- Routers exchange distance vectors in timed rounds with a configurable period. The metric is hop count, with infinity = 16 (RIP style).
- Toggles on the Route tab: **split horizon** and **poison reverse**.
- Count-to-infinity demo: cut a link that leaves a destination with **no** alternative path (e.g. Nok Kundi–Taftan, which cuts off Taftan and the Iran link). The current Quetta–Sibi demo can't count to 16, because Quetta has other paths. The round-by-round table on the panel is filled from the real vectors.
- **Tests:** with both toggles off the cut destination reaches 16 in N rounds; split horizon prevents the two-node loop; poison reverse withdraws it immediately.
- **Check:** packets visibly bounce between the two routers until TTL runs out, then stop at 16.

### 5 · Real link-state / OSPF (your item 3)
- Each router keeps its own link-state database. On a failure: detection delay (dead interval) → the adjacent routers originate a new LSA → flooding with per-hop delay → each router reruns Dijkstra after an SPF delay → installs its table.
- **Convergence time** is measured from the moment of failure until the last router installs its new table. It feeds the convergence chart and toast.
- The flooding wave is drawn from real LSA arrival times (the current pulse animation becomes real).
- **Tests:** every router's table matches a global Dijkstra after convergence; convergence time rises with network diameter and the per-hop delay.

### 6 · Simplified BGP (your item 4)
- About 12 ASes: PTCL AS17557, TWA, Cybernet/StormFiber, Nayatel, Multinet, Wateen, SCO, PCCW AS3491, YouTube AS36561, plus two or three generic transit/Tier-1 ASes and "rest of world" sources. All ASNs are verified in `docs/REFERENCES.md` §2 (TWA 38193, Cybernet 9541, Nayatel 23674, Multinet 9260, Wateen 38264, SCO 18053); the relationships are CAIDA inferences and get labelled as such.
- The RPKI comparison is honest about dates: RPKI did not exist in 2008, but today YouTube's /22 has ROAs (AS43515, AS36040), so the replay can show "2008 rules" against "today's rules".
- Relationships: customer, peer (PKIX) and provider. Route choice: customer > peer > provider, then shortest AS path, then a tie-break. Gao-Rexford valley-free export. UPDATE and WITHDRAW messages with delays.
- The data plane uses **longest-prefix match**, which is the real mechanism of 2008.
- **The 2008 hijack:** PTCL originates `208.65.153.0/24` internally to black-hole YouTube. The fault we inject is a **missing export filter** toward PCCW; PCCW has no customer prefix filter. From there the BGP rules spread the /24, longest-prefix match beats YouTube's /22, and traffic from abroad flows into Pakistan. No timed script.
- BGP picks the egress AS and cable for international flows; inside Pakistan the IGP carries the traffic.
- **Tests:** valley-free export holds; the /24 reaches the "world" ASes only when the filter is missing; removing it (or ROV, in step 7) withdraws it.

### 7 · Adaptive defence (your item 5, tied to Ms. Sajjad's research)
- Framed as a **MAPE-K loop** (Monitor, Analyse, Plan, Execute, over shared Knowledge), the standard model for self-adaptive security systems. That is the link to her adaptive-security work.
- **Monitor/Analyse:** a per-destination rate EWMA with z-score spike detection; Shannon entropy of the source distribution (catching a DDoS from many unusual sources); periodic-beacon detection for the compromised-phones scenario.
- **RPKI-style origin validation:** a ROA table; announcements are classed valid / invalid / not-found; route-origin validation (ROV) at chosen ASes drops invalid ones, so the hijack is stopped *by BGP itself*.
- **Plan/Execute:** reroute; divert attack traffic to a scrubbing centre (Karachi DC) and forward the clean traffic; rate-limit; quarantine plus step-up authentication for compromised devices (adaptive access control).
- **Before/after:** the same seeded scenario run with defence off and on, with overlaid charts of goodput, loss and latency, plus time-to-detect, time-to-mitigate and collateral (false positives).
- **Tests:** the detectors fire on attack traces and stay quiet on normal diurnal traffic; ROV drops the hijack /24.

### 8 · Scenario stories (guided presentations)
Each scenario becomes a short story you can present from, instead of a few alert lines in the Security tab.
- **Story player:** a presentation overlay with a title card (incident, date, who was involved), then numbered *beats*. Each beat has a heading, 2–3 sentences, an on-map callout pinned to the routers or cables involved, a camera move, and a source line at the bottom. Controls: previous / next / autoplay, a progress timeline, and Esc to leave. The side panel and KPIs dim, but the map stays live.
- **The simulation drives each beat.** A beat *triggers* something in the model (remove PTCL's export filter, cut a cable, start a botnet) and the narration describes what actually emerges: the AS-path panel, real loss and latency, packets rerouting. Nothing is a timed animation pretending to be the network.
- **Better visuals for stories:** an AS-level overlay (ASes as labelled bubbles, announcements travelling along AS links), a "what the routers believe" table that fills in live, a world inset for traffic arriving from abroad, a before/after split chart at the end.
- **Each story ends** with "what fixed it", "what would have prevented it" (ROV, filters, a second landing site…), and an option to replay it with adaptive defence on.
- **Scenario library.** Candidates, all to be confirmed by the research (step R) before they're built:
  - 2008 YouTube hijack by PTCL (the existing one, rebuilt)
  - 2005 SMW3 cut, when Pakistan had a single cable: 12 days down, satellite fallback (confirmed; SANOG 6 talk, Dawn)
  - 2008 Mediterranean cable cuts (SMW4 and FLAG near Alexandria): about 80% of Pakistan's prefixes affected (confirmed)
  - 2024 Red Sea cable cuts (including AAE-1). The effect on Pakistan is unverified, so the story says so
  - January 2025 AAE-1 fault near Qatar: PTCL moved about 1.8 Tbps to IMEWE and 1.5 Tbps to SMW4 (confirmed)
  - September 2025: SMW4 and IMEWE cut near Jeddah while SMW5, AAE-1 and PEACE kept running (confirmed)
  - 20 October 2025: PEACE cut near Sudan (confirmed, ISP statement)
  - A Facebook-style mass withdrawal (2021): a big content network vanishes, and the CDN caches in Pakistan go dark
  - A Verizon/DQE-style route leak (2019) re-enacted with a Pakistani ISP's customer (hypothetical, labelled as such)
  - A Mirai-style IoT botnet DDoS on a Pakistani data centre (illustrative)
  - Karachi losing every cable: the single point of failure, and what a Gwadar landing would change
  - KKH landslide: Gilgit-Baltistan fails over to microwave
  - Compromised phones and adaptive access control (the link to Ms. Sajjad's research)
- You pick the final set after the research comes back.

### R · Fact research and the reference document (runs in the background from today)
- Every fact the project uses gets checked against primary sources (operator press releases, PTA/PTCL/TWA statements, submarinenetworks.com, TeleGeography, RIPE/ARIN records, the original incident write-ups, papers). Each fact is marked confirmed, corrected or unverified.
- **`docs/REFERENCES.md`** records each fact, each design decision (link capacities, delay factor, buffer sizing, RIP infinity, OSPF timers, BGP policy model, detection thresholds, the MAPE-K framing) and the source it was taken from.
- The UI's Sources screen, each story's source lines and the final report all draw from this one document.

### 9 · Detailed coastline (your item 6a)
- Offline data script: fit the 6 coarse province polygons to the detailed Natural Earth 10 m Pakistan outline. Buffer each province slightly outward, intersect with the detailed outline, then resolve overlaps in a fixed order (`polygon-clipping`, plus `@turf/buffer` as a dev dependency). Write the result to `data/prov_fitted.json`, which gets committed.
- Landing stations re-snap to the new coast, and cable start points follow.
- **Risk:** the Natural Earth outline and the Highcharts provinces may disagree near Kashmir. I'll check this first and tell you before choosing a fix.
- This step doesn't depend on any other, so it can run in its own session in parallel.
### 10 · Presentation material (your item 8)
- **Sources & credits** screen (opened from the brand card): data sources, libraries, facts with citations, all generated from `docs/REFERENCES.md`.
- **"Representative topology" disclaimer:** shown on first load and kept as a footnote. It says that internal ISP topology isn't public, the corridors follow highways, and the operator per corridor is illustrative.
- **Africa-1 / 2Africa status:** I check it with a web search now, and again within a week of your demo, then update the cable status and the copy.
- **Report (.docx), built from `docs/REFERENCES.md`:** method, the design decisions and where each came from, assumptions table, results (charts from `scripts/experiment.mjs`: cable-cut congestion, DV with and without split horizon, OSPF convergence vs diameter, hijack spread, defence before/after), limitations.

---

## Rough schedule (2–4 weeks)

| Week | Steps |
|---|---|
| 1 | 0, 1, 2 (you pick a mockup early in the week), R in the background, 9 in parallel |
| 2 | 3, 4, 5 |
| 3 | 6, 7 |
| 4 | 8, 10, buffer |

## Facts to verify before the demo
- Cable capacities (shown as representative, not exact).
- Whether Africa-1, 2Africa and SMW6 are carrying traffic (checked 21 Nov 2026: Africa-1 no, 2Africa unconfirmed, SMW6 conflicting).
- Ms. Sajjad's publication list: ask her to confirm it before it goes on a slide (REFERENCES §4).
- Whether the Natural Earth Pakistan outline includes Azad Kashmir and Gilgit-Baltistan as the current slabs do.

## Risks
- **Browser performance** of the event engine: cap events per frame, and move `sim/` into a Web Worker if needed (the module split makes this easy).
- **Scaling honesty:** dots are bundles and capacities are representative. Say so in the UI, the report and the presentation.

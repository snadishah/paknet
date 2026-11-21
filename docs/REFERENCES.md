# PAKNET references and fact check

This file is the single source for the app's Sources screen, the source lines on the story slides, and the final course report (see `docs/PLAN.md`, step R).

- **Research date:** 21 November 2026. Every web page was opened on that day unless the entry says otherwise.
- **How current it is:**
  - The live databases were read on 21 Nov 2026: the TeleGeography cable-map API, PeeringDB, RIPEstat, the Internet Society IXP tracker, and CAIDA AS Rank (dataset dated 2026-11-01).
  - The newest published report on Pakistan's cables is the PACRA sector study of 21 July 2026, about 4 months old. Its bandwidth figures are from FY23.
  - The newest Pakistani news found on 2Africa is a TechJuice article from about April 2026, about 7 months old. That date is inferred from the page.
  - Nothing found from August to November 2026 changes the status of Africa-1, 2Africa or SMW6. Check again within a week of the demo (PLAN step 10).
- **Status labels:**
  - **CONFIRMED**: a primary or best-available source supports the claim as written.
  - **CORRECTED**: the claim is wrong or incomplete; the correct value is given.
  - **UNVERIFIED**: no source good enough was found or could be opened.
  - **CONFLICTING**: credible sources disagree.
- **Citations:** `[S12]` and similar refer to the numbered **Source list** at the end. Each entry there gives title, publisher, date and URL. Pages I could not open are listed separately and are never used as the basis for a status.
- **News sources:** wherever a fact rests only on news (Dawn, Express Tribune, ProPakistani, TechJuice, Profit, APP, Daily Times), the row says "(news)". These were used only when no operator, regulator or registry page was available.

---

## 0. Summary: items that change what the app shows

| # | Item in CLAUDE.md / app | Status | What to show instead | Sources |
|---|---|---|---|---|
| 1 | Africa-1 "landed, capacity pending as of late 2025" | **CORRECTED** | Landed 22 Feb 2025 at PTCL's **Sea View** site (not Hawksbay). It ends at the Misrishah exchange, DHA Phase VI. **Not in service yet.** PTCL's Q1/early-2026 RFS target has passed. TeleGeography now lists it as *planned, RFS 2027*. | S06, S07, S02, S03 |
| 2 | 2Africa "landed, capacity pending" | **UNVERIFIED** (likely still pending) | Landed at TWA's Hawksbay station (shore end from 1 Dec 2024; TWA announced the landing on 27 Feb 2025). PTA targeted go-live in Q4 2025. No official activation notice found. PACRA (Jul 2026) and TechJuice (~Apr 2026) still describe it as pipeline or "once fully operational". Show it as "landed, not yet confirmed in service". | S08, S09, S17, S19 |
| 3 | SMW6 "landed at Hawke's Bay in Nov 2025" | **CONFLICTING** (landing CONFIRMED, service status conflicting) | MoITT announced on 22 Nov 2025 that SMW6 was connected, with 13.2 Tbps allocated to Pakistan and 4 Tbps activated immediately (news). TeleGeography still lists the system as *planned, RFS 2027*, and PACRA (Jul 2026) lists SMW6 as pipeline. Show "landed Nov 2025; partial capacity reported active; system RFS pending". | S12–S15, S04, S19 |
| 4 | Pak-China OFC "171 km aerial fibre" | **CONFLICTING** | AidData gives 171 km in one section and 172 km in another; Dawn (2018) gives 172 km. Show "~171–172 km". | S26, S28 |
| 5 | "26 microwave **nodes** Rawalpindi–Karimabad" | **CONFLICTING** (wording) | Dawn says 26 high-capacity microwave **links** as backup, plus 9 node centres. AidData uses both "nodes" and "links". Show "26 microwave links (backup)". | S26, S28 |
| 6 | OFC Phase II (Karachi, Gwadar, Gwadar landing) | **UNVERIFIED** (status) | Plan CONFIRMED: ECNEC approved Rs 37.9 bn in Jan 2021, with a Khunjerab–Karachi route, a Gwadar landing station and 7,990 km of fibre. No completion found. Show as "planned / under way". | S29, S30 |
| 7 | "PKIX exchanges: Islamabad, Karachi, Lahore" | **CORRECTED** (incomplete) | PKIX sites confirmed (Islamabad 2017, Karachi 2019, Lahore late 2021). Today the only Pakistani IX with listed members in PeeringDB and the ISOC tracker is **PIE Karachi**, run by DE-CIX with PTCL (9 networks). PKIX Lahore shows 0 networks; Islamabad and Karachi are not listed. Add PIE Karachi; mark PKIX activity unverified. | S31, S33–S36 |
| 8 | PEACE "Cybernet" | CONFIRMED; **Gwadar landing CONFLICTING** | Submarine Networks says PEACE lands in Karachi **and Gwadar**. TeleGeography lists **Karachi only**. Do not draw a Gwadar PEACE landing as live. | S01, S05 |
| 9 | Total international capacity | **CONFLICTING** | PTA presentation (via TechJuice): 17.21 Tbps installed, 13.01 Tbps active. PACRA (Jul 2026, FY23 data): ~17.7 Tbps total, ~7.7 Tbps active. Dawn (Jan 2025): six cables ~13 Tbps, 7–8 Tbps used. Use ~13–17 Tbps and label it "representative". | S18, S19, S20 |
| 10 | YouTube prefix today | **CORRECTED** (for present-day use only) | The 2008 facts stand. **Today** 208.65.152.0/22 is originated by **AS43515** (YouTube, Google Ireland), not AS36561. It has ROAs (AS43515 and AS36040, maxLength /22), so a /24 from AS17557 would be **RPKI Invalid** today. AS36561 announces nothing now. | S44 |
| 11 | End time of the 2008 hijack | **CONFLICTING** (minor) | PCCW withdrew at 20:59:39 UTC per Renesys and 21:01 UTC per RIPE NCC. "About 2 hours" is CONFIRMED. | S42, S43 |
| 12 | Delay route factor 1.4 | **CONFLICTING** (with literature) | Singla et al. (2014): fibre lengths are usually 1.5–2× road distances, and roads ≈ geodesic, on Internet2/GÉANT. 1.4 is optimistic. Recommend 1.5 as default and label it an assumption. | S91 |
| 13 | ASNs other than 17557 / 3491 / 36561 | CONFIRMED (registry) | TWA AS38193, Cybernet/StormFiber AS9541, Nayatel AS23674, Multinet AS9260, Wateen AS38264 (+AS55356), SCO AS18053, Jazz AS45669 (+AS58470), CMPak/Zong AS59257, Telenor PK AS24499. Relationships are **inferred** (CAIDA). | S45–S47 |
| 14 | Instructor's publications | **UNVERIFIED** (authorship near-certain, not proven) | 4 papers are listed on a Google Scholar profile for "Maryam Sajjad", which has a verified seecs.edu.pk e-mail but shows "Lecturer, SZABIST Islamabad". The SEECS page lists her as Lecturer but no publications. See §4. | S110–S115 |
| 15 | 2024 Red Sea cuts' effect on Pakistan | **UNVERIFIED** | AAE-1 was cut (Kentik). No opened source quantifies the effect on Pakistan. | S50 |
| 16 | 2004 TTNet and 2017 Rostelecom numbers | **UNVERIFIED** (primary sources not opened) | See §5. | — |
| 17 | Mirai/Dyn bot count | **CONFLICTING** | Dyn first spoke of "tens of millions" of IPs (quoted by APNIC/RIPE Labs). The widely reported ~100,000 endpoints figure came from Dyn's later statement, which was not opened. | S59 |

---

## 1. Facts check

### 1.1 Submarine cables that land in Pakistan

All landings are in Karachi. TeleGeography lists only one Pakistani landing point, `karachi-pakistan`, for every Pakistan cable [S02]. The landing station operator is given below.

| Cable | Landing party / station (PK) | Landing site | In service for Pakistan? | Status of the CLAUDE.md claim | Sources | Note |
|---|---|---|---|---|---|---|
| SMW3 | PTCL | Hawksbay | **Retired** | CONFIRMED | S01 | TeleGeography no longer lists it for Pakistan [S02]. |
| SMW4 | PTCL | Hawksbay | Yes; RFS 13 Dec 2005 | CONFIRMED | S01, S25, S02 | Design 1.28 Tbps, upgraded to 4.6 Tbps in 2015 (system), 2 fibre pairs [S25]. |
| IMEWE | PTCL | Hawksbay | Yes; RFS 11 Dec 2010 | CONFIRMED | S01, S24 | 3 fibre pairs; 3.84 Tbps design, 5.6 Tbps after 2016, 200G waves from 2019 (system) [S24]. |
| AAE-1 | PTCL | **Clifton beach**, near Captain Farhan Ali Shaheed Park | Yes; commercial service Jun 2017 | CONFIRMED | S01, S20, S22 | 5 pairs; >40 Tbps design, >100 Tbps after 2022 upgrade (system) [S22]. |
| Africa-1 | PTCL | **Sea View** beach; ends at Misrishah exchange, DHA Phase VI | **No**; TeleGeography: planned, RFS 2027 | CORRECTED (see §0 #1) | S06, S07, S03 | 10,000 km, 8 pairs, 96 Tbps (system) [S06]. Owners include PTCL, e&, G42, Mobily, Telecom Egypt, ZOI, TeleYemen [S03]. |
| SMW5 | Transworld (TWA) | Hawksbay | Yes; RFS 13 Dec 2016 | CONFIRMED | S01, S23 | 24 Tbps design, 38 Tbps after 2019 (system) [S23]. |
| TW1 | Transworld (TWA), private cable | Hawksbay; ends at TWA's Karachi station | Yes; RFS 2006 | CONFIRMED | S01, S02 | Karachi – Al Seeb (Oman) – Fujairah (UAE) [S02]. |
| SMW6 | Transworld (TWA) | Hawkes Bay (news) | Partially, per MoITT; TeleGeography: planned, RFS 2027 | CONFLICTING (see §0 #3) | S10, S12–S15, S04 | TWA joined the consortium and announced it on 22 Feb 2024, with a Q1 2025 RFS target that was missed [S10]. MoITT announced on 22 Nov 2025: 19,200 km, >100 Tbps, PK allocation 13.2 Tbps, 4 Tbps active (news) [S12–S14]. Express Tribune calls it the ninth cable to land [S13]. |
| 2Africa | Transworld (TWA), for Meta / China Mobile Intl. | Hawksbay | Not confirmed | UNVERIFIED (see §0 #2) | S08, S09, S01, S17 | 45,000 km, 46 landings, 180 Tbps on 16 pairs (system) [S08]. TeleGeography gives RFS 2024 for the system as a whole, not the Pakistan branch [S02]. |
| PEACE | Cybernet (Cyber Internet Services) | Karachi (Gwadar disputed) | Yes; RFS Mar 2022 | CONFIRMED; Gwadar CONFLICTING | S01, S05 | Cybernet is the landing party [S01]. TeleGeography lists Karachi only and names the owner as PEACE Cable International [S05]. |

- **"About nine have landed" — CONFIRMED.** Leaving out SMW3, nine systems have landed in Pakistan: SMW4, IMEWE, AAE-1, Africa-1, SMW5, TW1, SMW6, 2Africa and PEACE.
- **Only six or seven carry traffic.** Profit and Dawn (Nov 2025, news) list six operating cables: AAE-1, SMW4, IMEWE, SMW5, TW1 and PEACE [S14, S12]. SMW6 is partly active [S14].
- **A tenth system is in the pipeline.** PACRA (Jul 2026) lists Africa-1, SMW6, 2Africa and the **Makran Gulf Gateway** as pipeline systems [S19]. The Makran Gulf Gateway was not researched further.

**Single point of failure.** All cables land in Karachi [S02], which CONFIRMS the CLAUDE.md claim. A Gwadar landing station is part of the Pak-China OFC Phase II plan (§1.4) [S30].

### 1.2 International capacity (total and per cable)

| Claim | Value | Status | Source | Note |
|---|---|---|---|---|
| Total installed / activated | 17.21 Tbps / 13.01 Tbps | CONFLICTING | S18 (TechJuice citing a "latest PTA presentation"; page date not shown, ~late 2025 inferred) (news) | Per cable, installed / active: AAE-1 4.77/3.58; SMW4 2.58/1.98; IMEWE 2.76/1.9; TWA-1 2.8/2.6; PEACE 1.6/0.8; Pak-China OFC 1/0.45 Tbps. SMW5 is not itemised. |
| Total / activated (FY26 report, FY23 data) | ~17.7 Tbps / ~7.7 Tbps (FY23: ~13.3 Tbps) | CONFLICTING | S19 (PACRA, 21 Jul 2026) | Its chart is sourced to TeleGeography, PTA, Submarine Networks and PEACE. The report notes the data are "latest available as of FY23". |
| Six cables, capacity and use (Jan 2025) | ~13 Tbps capacity; 7–8 Tbps used | CONFLICTING | S20 (Dawn, 3 Jan 2025) (news) | PTCL says each cable keeps up to 40% headroom for failover. |
| SMW6 allocation for Pakistan | 13.2 Tbps allocated; 4 Tbps active | CONFIRMED (news only) | S12, S14 | Comes from a MoITT statement. The PID press release could not be opened (certificate error). |

**Recommendation for the app:** use about 13 Tbps of lit international capacity and 7–8 Tbps of peak use as the baseline. Label both "representative", and cite S18, S19 and S20. Design capacities in §1.1 are for each **whole system**, not Pakistan's share.

### 1.3 Pak-China OFC (SCO)

| Claim | Status | Value found | Sources | Note |
|---|---|---|---|---|
| ~820 km, Rawalpindi–Khunjerab | CONFIRMED | 820 km | S26, S27, S28 | Segments: 18.2 km federal capital, 466 km GB, 280 km KP, 47 km Punjab [S27]. |
| 26 microwave nodes Rawalpindi–Karimabad as backup | CONFLICTING (wording) | "26 high capacity microwave links" + 9 node centres | S26, S28 | AidData's overview says "nodes", its narrative says "links". |
| 171 km aerial fibre Karimabad–Khunjerab | CONFLICTING | 171 km (AidData overview) vs 172 km (Dawn; AidData narrative) | S26, S28 | |
| Owner / builder / cost | CONFIRMED | SCO owner; Huawei EPC; $44 m, 85% China Eximbank concessional loan | S27, S28 | Groundbreaking 19 May 2016; completed 13 Jul 2018 [S28]. Commercial activation reported 1 Feb 2019 (news) [S27]. |
| Phase II: extension to Karachi and Gwadar, plus a Gwadar landing station | CONFIRMED (as a plan); status UNVERIFIED | ECNEC approved Rs 37.9 bn (Jan 2021); "Khunjerab–Karachi" network; 7,990 km; Gwadar landing station | S29, S30 | Soft launch in Gilgit on 30 Apr 2021 [S30]. No completion found. |
| International capacity via OFC | (new) | 1 Tbps installed, 0.45 Tbps active | S18 | News, citing PTA. |

### 1.4 Internet exchanges

| Claim | Status | Value | Sources | Note |
|---|---|---|---|---|
| PKIX in Islamabad, Karachi, Lahore | CONFIRMED (as of 2022) | Islamabad 2017, Karachi 2019, Lahore late 2021 | S31 | PTA coordinated it with APNIC support. Islamabad and Karachi are in HEC data centres; Lahore is in a PITB data centre. Facebook chose to place a cache at the Lahore IXP [S31]. |
| PKIX membership | CONFIRMED (2020) | 17 members, Islamabad and Karachi | S32 | ISOC also found that over 80% of "local content" was hosted outside Pakistan [S32]. |
| Current IXPs | CORRECTED (add) | **PIE Karachi powered by DE-CIX**, run as "DE-CIX as a Service" in partnership with PTCL; 9 networks; the only active PK IXP in the ISOC tracker (Nov 2026) | S33–S36 | PeeringDB still has a "PKIX Lahore" entry with 0 networks, last updated 2022 [S33]. |
| PIE Karachi members (PeeringDB, 21 Nov 2026) | CONFIRMED | AS17557 PTCL (100G), AS140307 (PIE, PTCL-registered), AS205529 (DE-CIX monitoring), AS140607 Sign In, AS139341 ACE, AS21859 Zenlayer, AS132165 Connect Communications, AS138915 Kaopu Cloud HK, AS136525 Wancom | S34, S45 | TWA, Cybernet, Nayatel, Multinet and Jazz do **not** appear at PIE Karachi in PeeringDB. |

### 1.5 PakSat-MM1

| Claim | Status | Value | Sources | Note |
|---|---|---|---|---|
| Geostationary at 38.2°E | CONFIRMED | 38.2°E | S37, S38, S39 | Satbeams rounds it to "38°E" [S41]. |
| Launched May 2024 | CONFIRMED | LM-3B from Xichang, 20:12 on 30 May 2024 (Beijing time, = 12:12 UTC) | S39 | DFH-4E platform [S39]. SUPARCO and PAKSAT pages still say "Launch (planned) 30 May 2024" [S37, S38]. |
| Payloads | CONFIRMED | C, Ku, Ka (HTS) and L-band (SBAS); 15-year design life | S37, S38 | |
| Gateway beams over Lahore, Karachi, Islamabad; 11 Ka-band spot beams | CONFIRMED (press release level) | as stated | S40 | Kacific / PAKSAT announcement (SatNews, 10 Mar 2025). Not found on SUPARCO's own pages. |

### 1.6 January 2025 AAE-1 fault

| Claim | Status | Detail | Sources |
|---|---|---|---|
| AAE-1 fault near Qatar, Jan 2025 | CONFIRMED (news; PTA statement) | Fault on Thursday 2 Jan 2025 near Qatar. Downdetector spike 20:00–23:00 PKT. Shortfall of at least 1 Tbps. | S20, S21 |
| PTCL shifted traffic to other cables | CONFIRMED | About 1.8 Tbps moved to IMEWE and 1.5 Tbps to SMW4. About 80% of the shortfall was recovered by 4 Jan. Those cables were already nearly full, so extra capacity had to be activated. | S21 |
| Context | — | A 2021 AAE-1 fault in Pakistani waters took about 45 days to repair (PTCL official). | S21 |

### 1.7 The 2008 YouTube hijack (AS17557)

| Claim | Status | Sources | Note |
|---|---|---|---|
| AS17557 (PTCL) announced 208.65.153.0/24 | CONFIRMED | S42, S43 | |
| It leaked through AS3491 (PCCW) | CONFIRMED | S42, S43 | First path seen was "3491 17557". PCCW passed it on without filtering [S43]. |
| YouTube = AS36561; covering prefix 208.65.152.0/22 | CONFIRMED (for 2008) | S42 | Today the /22 is originated by AS43515 (see §0 #10) [S44]. |
| Duration about 2 hours | CONFIRMED | S42, S43 | 18:47 to 20:59/21:01 UTC is about 2 h 12–14 min. |
| How far it spread | CONFIRMED | S43 | Spread to all 97 carrying ASNs in Renesys' feed within about 1 min 45 s. Renesys estimated it was seen by roughly two-thirds of the Internet. |

**Timeline, 24 Feb 2008 (UTC)** [S42 RIPE NCC; S43 Renesys]:

| Time (UTC) | Event |
|---|---|
| before | AS36561 announces 208.65.152.0/22. |
| 18:47 (18:47:45 first seen) | AS17557 starts announcing 208.65.153.0/24, and AS3491 propagates it. |
| 18:48:00 → 18:49:30 | 9 → 47 → 93 → 97 ASNs carry the bad route [S43]. |
| 20:07(:25) | YouTube announces the same /24 itself [S42, S43]. |
| 20:18(:43) | YouTube announces 208.65.153.0/25 and 208.65.153.128/25. These win by longest-prefix match. |
| 20:50:59 / 20:51 | PTCL's route reappears with AS17557 prepended (path 3491 17557 17557). |
| 20:59:39 (Renesys) / 21:01 (RIPE) | AS3491 withdraws the AS17557-originated routes, which ends the hijack. |

**Context (sensitive; keep it technical):** PTCL announced the /24 internally to carry out a domestic block order, and the announcement leaked outside Pakistan. Present the cause as a *missing export filter at PTCL plus no customer prefix filter at PCCW*, which matches PLAN step 6. Leave the policy background as a footnote.

---

## 2. ASNs and relationships

### 2.1 ASNs (registry data)

The registry data comes from RIPEstat `as-overview`, which reflects APNIC/ARIN delegations [S45], and from PeeringDB [S47], both queried on 21 Nov 2026.

| Operator | ASN(s) | Registry name | Status | Note |
|---|---|---|---|---|
| PTCL | **AS17557** (main), AS45595 | PKTELECOM-AS-PK | CONFIRMED | PeeringDB: NSP, ~7,000 IPv4 prefixes, 1–5 Tbps. AS45595 is a single-homed customer of 17557 [S46]. |
| PIE Karachi (PTCL / DE-CIX) | AS140307 | PIE-KARACHI-AS-AP (PTCL) | CONFIRMED | IX ASN. |
| Transworld Associates (TWA) | **AS38193** | TWA-AS-AP | CONFIRMED | PeeringDB aka "Transworld, TW1, TWA". The 2008 Renesys deck uses the same ASN [S48]. |
| Cybernet / StormFiber | **AS9541** (main); AS24440, AS58746 also registered to Cybernet | CYBERNET-AP | CONFIRMED (ASN); StormFiber = Cybernet's FTTH brand (secondary sources only) | PeeringDB: NSP, 1–5 Tbps. |
| Nayatel | **AS23674** (also AS136818) | NAYATEL-PK | CONFIRMED | |
| Multinet | **AS9260** (also AS55483) | MULTINET-AS-AP | CONFIRMED | |
| Wateen | **AS38264**; AS55356 | WATEEN-IMS-PK-AS-AP / WATEENTEL-AS-AP | CONFIRMED | PeeringDB lists AS38264 as "Wateen Telecom". AS55356 is a single-homed customer of 38264 [S46]. |
| SCO | **AS18053** | SNET-AS-AP | CONFIRMED | PeeringDB: 20–50 Gbps. |
| Jazz (PMCL / Mobilink) | **AS45669**; AS58470 ("Mobilink Peering") | Mobilink-AS-PK / JPL-PK-Peering-AS-PK | CONFIRMED | |
| Zong (CMPak) | AS59257 | CMPAKLIMITED-AS-AP | CONFIRMED | Optional for the sim. |
| Telenor Pakistan | AS24499 | TPP-AS-PK | CONFIRMED | Optional. |
| PCCW Global | **AS3491** | PCCWG-APAC-HK | CONFIRMED | CAIDA rank 10; 0 providers inferred (transit-free) [S46]. |
| YouTube | **AS36561** (2008); AS43515 originates the /22 today | YOUTUBE – Google LLC / Google Ireland | CONFIRMED | AS36561 announced 0 prefixes on 20 Nov 2026 [S44]. |
| Google | AS15169 | GOOGLE | CONFIRMED | |

### 2.2 Who buys transit from whom

These relationships come from **CAIDA AS Rank, dataset 2026-11-01** [S46]. They are **inferred from BGP paths**, not published contracts, so the app should call them "inferred". CAIDA's own field for clique membership returned "true" for every AS queried, which looks like a data artefact, so it is not used here.

| AS | Inferred providers (upstreams) | Key customers among sim ASes |
|---|---|---|
| PTCL 17557 | 13 providers: Level3 3356, Arelion 1299, Cogent 174, NTT 2914, HE 6939, Sparkle 6762, **PCCW 3491**, GlobalConnect 6797, Telstra 4637, Singtel 7473, Etisalat 8966, Zain Omantel 8529, TM 4788 | Multinet 9260, Cybernet 9541, Nayatel 23674, Telenor 24499, CMPak 59257, Jazz-peering 58470 |
| TWA 38193 | 11: Level3 3356, Cogent 174, Sparkle 6762, GlobalConnect 6797, DTAG 3320, CMI 58453, Singtel 7473, CTGNet 23764, Etisalat 8966, Zain Omantel 8529, du 15802 | Wateen 38264, Multinet 9260, Cybernet 9541, Nayatel 23674, CMPak 59257, **SCO 18053**, Jazz-peering 58470 |
| Cybernet 9541 | Level3, Arelion, Cogent, GlobalConnect, CTGNet, Prolexic 32787 (DDoS scrubbing), Zain Omantel, **PTCL 17557**, **TWA 38193** | 23 customers; 192 peers |
| Nayatel 23674 | PTCL 17557, TWA 38193, AS138677 | — |
| Multinet 9260 | PTCL 17557, TWA 38193, Jazz-peering 58470 | — |
| Wateen 38264 | TWA 38193, CMPak-enterprise 138423, Jazz-peering 58470 | AS55356 |
| SCO 18053 | TWA 38193 only | — |
| Jazz 58470 | PCCW 3491, OpenTransit 5511, Cloudflare 13335, PTCL 17557, TWA 38193 | Jazz 45669, Wateen 38264, Multinet 9260 |
| PCCW 3491 | none (transit-free) | PTCL 17557 (customer); Google 15169 (peer) |

**Modelling notes:**
- **(INFERRED)** PTCL and TWA act as the two domestic "tier-1s" and sell transit to most other Pakistani ISPs. Both buy from many international carriers.
- **(INFERRED)** PTCL is still a customer of PCCW, which matches the 2008 scenario (customer PTCL → provider PCCW). The 2008 Renesys deck also shows PTCL taking on new transit, including STIXLITE AS24493, BT 5400 and Telecom Italia 6762, during the cable cuts [S48].
- The table shows no PTCL–TWA peering edge. If the sim needs one, create it through PIE/PKIX and label it as an assumption.
- Cybernet's upstreams include Prolexic. That is a real-world example of buying DDoS scrubbing as a service, a useful precedent for step 7's "scrubbing centre".
- **PKIX/PIE membership:** only PIE Karachi's PeeringDB list is public (§1.4). PKIX member lists were not found.

---

## 3. Design parameters and where they come from

| Parameter | Value for PAKNET | Source | Status / note |
|---|---|---|---|
| Propagation speed in fibre | v = c / n_g. Corning SMF-28e+ lists an effective group index of 1.4682 at 1550 nm (1.4676 at 1310 nm), giving 204,190 km/s, i.e. **4.90 µs/km** (round to 5 µs/km). | S90 (Corning PI1463, Jun 2014) | CONFIRMED. Singla et al. also use roughly ⅔ c for fibre [S91]. |
| Route (circuity) factor | **1.5** recommended (plan says 1.4) | S91 (Singla et al., HotNets 2014, §4.1) | CONFLICTING: on Internet2 and GÉANT, fibre lengths are usually 1.5–2× road distances, and roads are close to geodesic. Treat it as a labelled assumption and put it on a slider (1.4–2.0). Related: Bozkurt et al., PAM 2017 (DOI checked via Crossref only) [S92]. |
| Buffer size | Rule of thumb B = RTT × C (e.g. 250 ms × 10 Gb/s = 2.5 Gbit). With n long-lived flows, B = RTT × C / √n. | S94 (Appenzeller, Keslassy, McKeown, SIGCOMM 2004) | CONFIRMED. PAKNET dots are bundles, so n is small: use the plain bandwidth-delay product with a **stated reference RTT** (not the link's own one-way delay), and label it. |
| Queue discipline | FIFO, tail drop | S80 (RFC 7567, BCP 197) | CONFIRMED as a common default. RFC 7567 describes tail drop and its problems (full queues, lock-out) and recommends AQM. Mention AQM as future work. |
| RIP infinity | 16 | S70 (RFC 1058 §2.1–2.2), S71 (RFC 2453 §3.4.1–3.4.2) | CONFIRMED. |
| RIP timers | Update every 30 s, offset by a random 0–5 s; route timeout 180 s; garbage-collection 120 s; triggered updates rate-limited by a random 1–5 s timer | S71 (RFC 2453 §3.8, §3.10.1) | CONFIRMED. In the sim, scale them with the network clock and say so. |
| Split horizon / poisoned reverse | Split horizon leaves a route out of updates sent to the neighbour it was learned from. Poisoned reverse includes it with metric 16. RFC 2453 calls poisoned reverse "safer" but notes it makes updates bigger. | S71 (RFC 2453 §3.4.3), S70 (RFC 1058 §2.2.1) | CONFIRMED. Neither fixes loops of three or more routers, which is the count-to-infinity case the plan's step 4 tests need. |
| OSPF interface timers | HelloInterval 10 s (LAN sample); RouterDeadInterval a multiple of Hello, "say 4" → 40 s; RxmtInterval 5 s; InfTransDelay 1 s | S72 (RFC 2328 App. C.3) | CONFIRMED (RFC values are "sample values"). |
| OSPF architectural constants | MinLSInterval 5 s; MinLSArrival 1 s; LSRefreshTime 30 min; MaxAge 1 h; MaxAgeDiff 15 min | S72 (RFC 2328 App. B) | CONFIRMED. |
| OSPF SPF / LSA throttling (vendor) | Cisco "optimize disabled" (older IOS): SPF 5000/10000/10000 ms; LSA throttle 0/5000/5000 ms; LSA arrival 1000 ms. "Optimize enabled" (IOS 16.5.1+): SPF 50/200/5000 ms; LSA 50/200/5000 ms; arrival 100 ms. | S83 (Cisco doc 211432, updated 18 Jul 2018) | CONFIRMED. Use the newer defaults and expose them as parameters. |
| BGP decision process | Phase 1: degree of preference (local policy, i.e. LOCAL_PREF). Phase 2 tie-breaks in order: (a) shortest AS_PATH, (b) lowest ORIGIN, (c) MED (same neighbouring AS only), (d) eBGP over iBGP, (e) lowest interior cost to NEXT_HOP, (f) lowest BGP Identifier, (g) lowest peer address | S73 (RFC 4271 §9.1.1, §9.1.2.2) | CONFIRMED. The RFC leaves "customer > peer > provider" to local policy; that rule comes from Gao–Rexford. |
| BGP timers | HoldTime 90 s; Keepalive = ⅓ HoldTime; ConnectRetry 120 s; MinASOriginationInterval 15 s; **MRAI 30 s eBGP / 5 s iBGP**; jitter × U(0.75, 1.0) | S73 (RFC 4271 §10) | CONFIRMED ("suggested default" values). |
| Valley-free / Gao–Rexford | Prefer customer > peer > provider. Export customer routes to everyone; export peer and provider routes only to customers. This guarantees convergence when the customer–provider graph has no cycles. | S95 (Gao 2001, ToN 9(6):733–745), S96 (Gao & Rexford 2001, ToN 9(6):681–692) | CONFIRMED: both DOIs verified via Crossref. The preference rule was checked in the Gao–Rexford text; the export rule is summarised from the paper. |
| Longest-prefix match | The forwarding table picks the most specific matching prefix. | S74 (RFC 1812 §5.2.4.3); RFC 4271 §9.1.4 | CONFIRMED. This is the mechanism behind the 2008 /24-vs-/22 and the /25 counter-move. |
| RPKI / ROV | RPKI architecture (RFC 6480). Origin validation states **Valid / Invalid / NotFound** (RFC 6811 §2). RPKI-to-Router protocol timers: Refresh 3600 s, Retry 600 s, Expire 7200 s (RFC 8210 §6) | S75, S76, S77 | CONFIRMED. Real ROAs exist for 208.65.152.0/22 today [S44]. |
| Route-leak definition and prevention | Leak defined in RFC 7908. BGP roles and Only-to-Customer (OTC) attribute in RFC 9234. Operations BCP in RFC 7454. Route-flap damping in RFC 2439. | S78, S79, S82, S81 | CONFIRMED (RFCs opened). RFC 9234 gives a principled "export filter" for the leak scenarios. |
| MAPE-K loop | An autonomic element = managed element + autonomic manager running **Monitor, Analyze, Plan, Execute** around **Knowledge** (Fig. 2). "Self-protection" is one of the four self-* properties. | S97 (Kephart & Chess, IEEE Computer 36(1):41–50, 2003) | CONFIRMED (text checked). The acronym "MAPE-K" comes from IBM's later blueprint documents, which were not opened. |
| Entropy-based anomaly / DDoS detection | Entropy of feature distributions (source and destination addresses, ports) exposes and classifies anomalies, including ones that barely change volume. | S98 (Lakhina, Crovella, Diot, SIGCOMM 2005); S99 (Feinstein et al., DISCEX 2003) | Lakhina CONFIRMED (text checked). Feinstein's metadata was verified via Crossref but the full text was not opened. |
| EWMA / z-score rate detector | EWMA_t = λ·Y_t + (1−λ)·EWMA_{t−1}; λ usually 0.2–0.3; limits = EWMA_0 ± k·σ·√(λ/(2−λ)), k usually 3 | S101 (NIST/SEMATECH e-Handbook §6.3.2.4); S100 (Roberts 1959, Technometrics 1(3)) | CONFIRMED. A z-score with a threshold of 3 is the λ = 1 special case. |
| Traffic matrix | Gravity model: traffic from i to j is proportional to the product of their weights (here, population). Good enough for **synthetic** traffic matrices. | S102 (Roughan, CCR 35(5), 2005); S103 (Zhang, Roughan, Duffield, Greenberg, SIGMETRICS 2003, "tomogravity") | CONFIRMED (text checked). |

---

## 4. Instructor's research (Ms. Maryam Sajjad)

**Identity check:**
- The SEECS faculty page lists **Maryam Sajjad, Lecturer, SEECS, NUST** (e-mail @seecs.edu.pk; MS NUST 2013–2017). It lists no publications or interests [S110].
- A Google Scholar profile for "Maryam Sajjad" lists interests in mobile computing, adaptive security and network security, with an e-mail verified at **seecs.edu.pk**. It gives her affiliation as "Lecturer, SZABIST Islamabad" [S111].
- A NUML faculty page for a "Ms. Maryam Sajjad, Lecturer" appeared in search results but **could not be opened** (certificate error).
- **Conclusion:** the research topics and the verified SEECS e-mail match the description in CLAUDE.md, so authorship is very likely. The Scholar affiliation differs, though, so **ask Ms. Sajjad to confirm the list before you cite it on a slide.**

| # | Paper | Venue, year | Identifier | Verified via |
|---|---|---|---|---|
| P1 | M. Sajjad, A. Ahmad, A. W. Malik, A. B. Altamimi, I. Alseadoon, "Classification and Mapping of Adaptive Security for Mobile Computing" | IEEE Transactions on Emerging Topics in Computing 8(3):814–832 (online 2018; issue 2020) | DOI 10.1109/TETC.2018.2791459 | Crossref, Semantic Scholar abstract [S113] |
| P2 | A. Ahmad, A. W. Malik, A. Alreshidi, W. Khan, M. Sajjad, "Adaptive Security for Self-Protection of Mobile Computing Devices" | Mobile Networks and Applications 28(2):653–672 (online 5 Sep 2019; issue 2023) | DOI 10.1007/s11036-019-01355-y | Crossref, Lancaster EPrints record [S112] |
| P3 | M. Sajjad, H. Anwar, M. A. Shibli, "Self adaptations in access control models in context of cloud computing" | 2015 Conference on Information Assurance and Cyber Security (CIACS), pp. 69–74 | DOI 10.1109/CIACS.2015.7395569 | Crossref [S114] |
| P4 | A. Joyia, A. Ghafoor, M. Sajjad, M. Q. Choudhary, "Secure and privacy enhanced email system as a cloud service" | ICDIM 2013, pp. 73–78 | DOI 10.1109/ICDIM.2013.6693986 | Crossref [S115] |

Google Scholar lists P1's second author as "AA Abbasi"; Crossref lists Aakash Ahmad. Use the Crossref list.

**What the papers say (summaries):**
- **P1 (mapping study).** P1 is a systematic mapping study of 43 studies (2003–2017) on adaptive security, also called self-protection, for mobile computing. It sorts the work into three themes: device data and resources, mobile-to-mobile communication, and mobile-to-server communication. It names the open challenges as **self-protecting mobile devices**, user-driven privacy decisions and **context-aware security** [S113].
- **P2 (framework).** P2 proposes a self-protection framework that combines **autonomic computing** and computer security to configure security measures at runtime. It includes an Android prototype and an evaluation of runtime threat detection and resource use [S112]. The abstract does not use the term MAPE-K, and the full text was not available, so whether P2 is built explicitly on MAPE-K is **UNVERIFIED**.
- **P3.** P3 is on self-adaptation in **access-control models** for the cloud; only its title and metadata were verified.

**How PAKNET's defence connects to this work** (wording suggested for the report and the slides):
- **The same loop at network scale.** Step 7 frames the defence as a Kephart–Chess autonomic manager [S97]:
  - **Monitor:** per-destination rate EWMA, source entropy, beacon periodicity.
  - **Analyse:** z-score and entropy thresholds; RPKI origin state.
  - **Plan:** reroute, scrub, rate-limit, or quarantine plus step-up authentication.
  - **Execute:** push forwarding-table, filter or ROV changes.
  - **Knowledge:** topology, ROA table, baselines.

  This is the "autonomic computing + security" combination that P2 applies on a single device. PAKNET applies it to routers and ASes.
- **Self-protection of mobile devices.** The "compromised phones" scenario (PLAN step 8) maps directly onto P1/P2's main theme: the network detects beaconing from mobile devices and adapts their access. The quarantine plus step-up authentication response is **adaptive access control**, the subject of P3.
- **Context-aware security.** The defence changes its response with context: time of day (expected load), which AS a route came from, and RPKI state. P1 lists context-awareness as an open challenge.
- **Honesty line:** say "inspired by" or "applies the same principles as" her published work. Do not say PAKNET implements her framework.

---

## 5. Scenario incidents

For each incident: the key facts, the best source opened, the effect on Pakistan, and its status.

### 5.1 2008 YouTube hijack by PTCL
See §1.7. Pakistan was the origin: YouTube was black-holed worldwide for about 2 h. **Status: CONFIRMED** [S42, S43]. The story should end on what would prevent it today: an export filter, customer prefix filters at PCCW, and ROV against the ROAs that now exist [S44, S76].

### 5.2 Jan–Feb 2008 Mediterranean and Gulf cable cuts

| Fact | Value | Source | Status |
|---|---|---|---|
| Cuts | SMW4 segment 4 (Alexandria–Marseille), 30 Jan 04:30 UTC, ~25 km off Alexandria. FLAG FEA segment D (EG–IT), 30 Jan 08:00 UTC, ~8.3 km off Alexandria. FALCON (AE–OM), 1 Feb 05:59 UTC, ~56 km from Dubai. A further cable failed between Qatar and the UAE. | S49 (RIPE NCC); S48 (Renesys, APRICOT 2008) | CONFIRMED. Renesys dates the FALCON cut to 2 Feb. |
| Repairs | SMW4: 8 Feb; FEA: 9 Feb 18:00; FALCON: 10 Feb 10:00 | S49 | CONFIRMED |
| Pakistan impact | 80% of Pakistani prefixes (1,079 of 1,351) had some outage. Big spike at 30 Jan 04:31 UTC with recovery by 06:30, a second lasting spike at 12:53, and gradual recovery from 13:38 UTC to 2 Feb. Verizon (701) lost routes to PTCL and TWA, and PTCL picked up new transit. | S48 | CONFIRMED (Renesys data) |

Story hook: three cables fail within days and Pakistan's BGP reachability collapses. Recovery comes from the market, as ISPs buy new transit, which teaches transit diversity.

### 5.3 2024 Red Sea cuts (AAE-1, Seacom, EIG; Rubymar)

| Fact | Value | Source | Status |
|---|---|---|---|
| Date and timing | 24 Feb 2024. Seacom/TGN-EA ~09:46 UTC, AAE-1 ~09:51 UTC (both inferred from BGP). EIG was already mostly down from an earlier fault. | S50 (Kentik, 31 Mar 2024) | CONFIRMED |
| Cause | Leading theory: the Rubymar, hit by missiles and abandoned, dragged its anchor across the cables. It sank on 2 Mar. Not confirmed. | S50 | CONFIRMED as "leading theory" |
| Effect on Pakistan | AAE-1 is a Pakistani cable (PTCL). No source opened quantifies the effect in Pakistan. | — | **UNVERIFIED** |

### 5.4 January 2025 AAE-1 fault near Qatar
See §1.6. **CONFIRMED** (news plus PTA statement) [S20, S21].

### 5.5 Other Pakistan cable faults, 2021–2025

| Date | Event | Source | Status |
|---|---|---|---|
| Feb 2021 – Aug 2024 | A table from documents seen by ProPakistani, source not named. TW-1 land cut in Egypt (Feb 2021). AAE-1 land cut in UAE (Dec 2021). TW-1 undersea fault ~400 km off Karachi, ~3 months (Feb 2022). SMW5 land cut in Egypt (Nov 2022, Feb 2024). AAE-1 land cut in France, 250 Gbps (Apr 2023). **SMW4 undersea cut offshore near Karachi, 1,500 Gbps (17 Jun 2024)**. PTCL route configuration error (31 Jul 2024). AAE-1 maintenance, 250 Gbps (17 Aug 2024). | S52 (ProPakistani, 25 Oct 2024) (news) | UNVERIFIED (source document not identified). A TW-1 "land cut in Egypt" is odd for a Karachi–Oman–UAE cable. |
| 5–6 Sep 2025 | **Red Sea cuts near Jeddah: SMW4 and IMEWE**, plus EIG and FALCON per Kentik; impacts from ~22:30 UTC on 5 Sep. PTCL confirmed reduced capacity on SMW4 and IMEWE and arranged alternate routes. **SMW5, AAE-1 and PEACE were unaffected.** Cause unconfirmed (anchor theory). | S51 (Kentik, 9 Sep 2025); S57b (Daily Times, 6 Sep 2025) (news) | CONFIRMED |
| 14 Oct 2025 | PTCL planned repair of a faulty repeater, up to 18 h (search results only; page not opened) | — | UNVERIFIED |
| 20 Oct 2025 | **PEACE cut in the Red Sea near Sudan, ~17:30 PKT.** StormFiber restored over 60% of the lost capacity quickly via alternate cables and new capacity through the UAE, Oman and Hong Kong, and promised full recovery by 27 Oct 23:59. It also said IMEWE and SMW4 had had outages in recent months. | S53 (Dawn, 24 Oct 2025) (news, ISP statement) | CONFIRMED (as the ISP's statement) |

**The "Oct 2025 PEACE/IMEWE event" in the app:** the PEACE cut of 20 Oct 2025 is confirmed. The IMEWE problems around that time were separate: the 5–6 Sep cut and the repeater repair of about 14 Oct. Tell them as two events, not one.

### 5.6 2021 Facebook/Meta withdrawal

| Fact | Value | Source | Status |
|---|---|---|---|
| Root cause | A command meant to assess backbone capacity took down all backbone links, and an audit-tool bug failed to stop it. DNS servers that could not reach the data centres then withdrew their own BGP routes. | S54 (Meta Engineering, 5 Oct 2021) | CONFIRMED |
| Timeline (UTC, 4 Oct 2021) | Burst of routing updates ~15:40; DNS prefixes 185.89.218.0/23 and 129.134.30.0/23 gone by 15:50–15:58; BGP activity back ~21:00; DNS working ~21:20–21:28. AS32934. Resolvers saw about 30× normal queries. | S55 (Cloudflare, 4 Oct 2021) | CONFIRMED |
| Pakistan link | Facebook placed a cache at PKIX Lahore [S31]. A story of "local caches go dark" is plausible: caches cannot help when DNS fails. | S31 | INFERRED. Label the Pakistani part as illustrative. |

### 5.7 2019 Verizon / DQE route leak
24 Jun 2019, ~10:30 UTC:
- A Noction BGP optimizer at DQE (AS33154) created more-specific routes, e.g. it split 104.20.0.0/20 into two /21s.
- DQE passed them to its customer Allegheny Technologies (AS396531), which leaked them to its other provider, **Verizon AS701**. Verizon accepted and propagated them.
- Cloudflare saw about a 15% drop in its global traffic at the worst point.
- Cloudflare names RPKI ROV, max-prefix limits and IRR-based filtering as the fixes.

**CONFIRMED** [S56]. For PAKNET, re-enact it as a *hypothetical* leak by a multihomed customer of PTCL and TWA, and label it as such.

### 5.8 2010 China Telecom route leak
- On 8 Apr 2010, AS23724 (China Telecom) announced about **50,000** prefixes belonging to other ASes, seen with the AS-path ending "4134 23724 23724".
- More than 99% of them matched existing routes, which suggests a leak of AS23724's own table rather than targeted sub-prefix hijacks.
- Some traffic was **intercepted**: it passed through China Telecom and then reached the real destination.
- Providers that preferred customer routes helped make that interception possible.

**CONFIRMED** [S57 (Hiran, Carlsson, Gill, PAM 2013)]. The "18 minutes" duration and the "37,000 prefixes" figure come from search snippets of BGPMon/Renesys posts that were not opened: **UNVERIFIED**.

### 5.9 2018 Amazon Route 53 / MyEtherWallet
- 24 Apr 2018, ~11:05–12:55 UTC. eNet (**AS10297**) announced more-specific /24s inside Amazon's (AS16509) Route 53 DNS ranges, e.g. 205.251.192.0/24, 193, 195, 197 and 199. Hurricane Electric (AS6939) carried them on.
- The hijacked "DNS servers" returned false answers for myetherwallet.com and poisoned resolvers, including 1.1.1.1 in some locations.
- Users who clicked past a self-signed certificate warning had their accounts drained.

**CONFIRMED** [S58 (Cloudflare, 24 Apr 2018)]. Reported losses of about $150–160k come from news found in search only: UNVERIFIED.

### 5.10 2016 Mirai / Dyn DDoS
- 21 Oct 2016. Dyn reported mitigation from 11:10 UTC, said service was restored at 13:20 UTC, and reported a second wave at 15:52 UTC. One Dyn prefix was withdrawn and re-announced between 15:58 and 17:00 UTC. BGP was otherwise mostly stable.
- Affected services included Twitter, GitHub, Reddit, Spotify, Netflix and PayPal [S59 (APNIC Blog / RIPE Labs, 26 Oct 2016)].
- Mirai peaked at about **600k** infected IoT devices [S60 (Antonakakis et al., USENIX Security 2017)].
- Bot count for the attack: **CONFLICTING** (see §0 #17).

**Effect on Pakistan:** none documented. As a PAKNET scenario it is an *illustrative* DDoS on a Karachi data centre, which needs to be labelled.

### 5.11 2004 TTNet (AS9121) full-table leak
- 24 Dec 2004. Over 100,000 prefixes were leaked from AS9121 starting about 09:19:57 UTC. Telecom Italia (AS6762) propagated them through an unfiltered session.
- These details come from a search snippet of the Renesys NANOG 34 slides (Popescu, Premore, Underwood, "The Anatomy of a Leak: AS9121"). The slides themselves returned **HTTP 402** and could not be opened.
- **Status: UNVERIFIED**, except for the date and AS number, which multiple sources agree on.

### 5.12 2017 Rostelecom (AS12389)
- On 26–27 Apr 2017 (UTC), BGPMon detected routes for prefixes of financial firms, including Visa, re-originated by Rostelecom. The SANS ISC diary notes it may have been one of Rostelecom's customers [S61 (SANS ISC, 27 Apr 2017)].
- ThousandEyes' figures, 137 prefixes in a window around 22:36–22:43 UTC with 36 of them belonging to firms such as Visa and Mastercard, could not be verified: its page returned **HTTP 403**, and BGPMon's original post could not be reached.
- **Status:** the date and the Visa victim are CONFIRMED; counts and timing UNVERIFIED.

### 5.13 Suggested extra scenarios (factual, teachable, Pakistan-relevant)

1. **2005 SMW3 cut, when Pakistan had a single cable** (best fit for the "Karachi single point of failure" story).
   - **Facts:**
     - On 27 Jun 2005 at 20:55, all international connectivity was lost when SMW3 was cut about 35 nmi (69 km) south-west of Hawksbay [S62].
     - Traffic moved to 3 E3 satellite links, which made little difference. Larger satellite backup was in place by 1 Jul. The cable was repaired on 8 Jul at 12:24 [S62]; Dawn reports PTCL saying service was back at 11:54 [S63].
     - The PTCL president blamed a ship's anchor [S63].
     - Telenor's SANOG talk reports that prefixes vanished, that shifting announcements between satellite links caused **route flapping and flap damping**, and that more than 10 million users and ISD calls were affected [S62].
   - **Teaches:** failover, satellite capacity limits, and route-flap damping (RFC 2439) [S81].
   - **Status:** CONFIRMED; the small difference in restoration time is noted.
2. **Sept 2025 Red Sea cuts, with path diversity saving the day.**
   - SMW4 and IMEWE (PTCL) were cut near Jeddah while SMW5, AAE-1 and PEACE kept running [S51, S57b]. Five weeks later PEACE was cut [S53].
   - **Teaches:** correlated risk on one geographic route, and why operators buy capacity on several cables.
   - **Status:** CONFIRMED.
3. **14 Mar 2024 West Africa multi-cable failure.**
   - WACS, MainOne, SAT-3/WASC and ACE all failed off Côte d'Ivoire. Disruptions began around 05:00 UTC and affected 13 countries [S64 (Cloudflare, 14 Mar 2024)].
   - **Teaches:** one physical event can cut several "independent" cables, a direct analogue for Karachi and Hawksbay.
   - **Status:** CONFIRMED. The undersea rock-slide cause comes from ISOC and TeleGeography pages that were not opened.
4. **2022 Rogers outage (Canada)**, optional and not Pakistan-related.
   - An internal routing configuration change during a core upgrade took down the whole IP network for about a day.
   - It teaches IGP/BGP blast radius, but the CRTC/Xona report pages returned **HTTP 403**, so it is **UNVERIFIED**. Build it only after the primary report is read.

**Sensitive (avoid, or keep strictly technical):**
- Government-ordered shutdowns and throttling in Pakistan, including the Feb 2024 election-day mobile shutdown and the 2024 "firewall" slowdown debate. These are politically charged and not needed for the course.
- If any is mentioned, use only a technical measurement source (e.g. Cloudflare Radar) and flag it as sensitive.

---

## 6. Open questions / could not verify

1. **Africa-1 RFS date.** TeleGeography says 2027. No PTCL PSX filing announcing RFS or a delay was found.
2. **2Africa in Pakistan.** No official PTA, TWA or Meta activation notice was found. One non-official site (Pediastan) claims it is fully live. That claim is not accepted.
3. **SMW6 status.** MoITT (Nov 2025) reports 4 Tbps active; TeleGeography (system RFS 2027) and PACRA (Jul 2026, "pipeline") disagree. The PID press release could not be opened (certificate error).
4. **Total lit international capacity.** The PTA-sourced figure (17.21 / 13.01 Tbps) reached me only through TechJuice, and the PTA presentation itself was not found. PACRA's activated figure (7.7 Tbps) is from FY23.
5. **PEACE Gwadar landing.** Submarine Networks and TeleGeography disagree.
6. **PKIX today.** Whether the Islamabad, Karachi and Lahore PKIX exchanges are still active, and who their members are.
7. **Pak-China OFC.** The aerial length (171 vs 172 km), "26 nodes" vs "26 links", and Phase II progress.
8. **2024 Red Sea cuts.** The effect on Pakistan has not been quantified.
9. **Instructor's papers.** Need confirmation from Ms. Sajjad that the Scholar-listed papers are hers, and whether P2 uses a MAPE-K architecture.
10. **Incident details.** TTNet 2004 figures (NANOG 34 slides, HTTP 402); Rostelecom 2017 counts (ThousandEyes, HTTP 403; BGPMon unreachable); China Telecom 2010 duration (BGPMon/Renesys posts not opened); Dyn bot count (Dyn blog not reachable).
11. **The ProPakistani fault table** (2021–2024). The underlying document is not identified.
12. **Makran Gulf Gateway** (PACRA's pipeline list). Not researched.

---

## 7. Simulation parameters used in the app (step 3)

All values live in `src/sim/params.js`. **Sourced** values cite a section above; **assumption** values have no public figure and are labelled as such in the app and the report.

| Parameter | Value | Basis |
|---|---|---|
| Fibre propagation | 5 µs/km × route factor 1.5 | Sourced (§3; Singla et al. 2014, §0 #12) |
| Geostationary hop | 120 ms each way (~35,786 km at c) | Physics |
| Bundle size (one moving dot) | 0.1 Gbit | Modelling choice: per-packet simulation of Tbps is impossible in a browser |
| Slow motion | 2 ms of network time per wall second at 1× | Modelling choice (Karachi → Lahore ≈ 4 s on screen) |
| Router buffers | 5 ms of line rate | Sourced rule B = RTT × C / √n (§3, Appenzeller et al. 2004) with RTT 100 ms, n ≈ 400: assumption on RTT and n |
| Cable capacity (Gbps, per direction) | AAE-1 3580, SMW4 1980, IMEWE 1900, TW1 2600, PEACE 800, Pak-China OFC 450 | Sourced: PTA active figures via TechJuice (§1.1, §0 #9) |
| SMW5 | 1700 | Inferred: remainder of PTA's 13.01 Tbps active total (SMW5 not itemised) |
| SMW6 | 4000 | Sourced but conflicting: MoITT Nov 2025 (§0 #3) |
| Africa-1, 2Africa, Gwadar cable (what-ifs) | 2000 each | Assumption |
| Domestic fibre | 2.5 Tbps per operator on trunks (≥3 operators), 1 Tbps per operator on regional routes | Assumption (internal topology is not public). Sized so the Karachi–Lahore corridor can carry the international traffic that leaves Karachi |
| Last mile | max(100 Gbps, population ÷ 2500) | Assumption |
| Microwave links | 20 Gbps | Assumption (modern multi-carrier / E-band) |
| Data centre / IXP / scrubbing uplinks | 2.5 / 2 / 10 Tbps | Assumption |
| Satellite links | 5 Gbps gateway, 1 Gbps terminal | Assumption (no public PakSat-MM1 throughput found) |
| RIP metric and infinity | hop count, 16 = unreachable | Sourced (§3, RFC 2453) |
| RIP update timer | 30 s, compressed to one round per 0.7 s on screen | Sourced timer (§3, RFC 2453 §3.8); compression is a modelling choice |
| RIP split horizon / poison reverse | optional, off by default | Sourced (§3, RFC 2453 §3.4.3) |
| Link-down detection | at the start of the next round | Simplification (RIP's 180 s timeout replaced by interface-down detection) |
| Forwarding hop limit (TTL) | 32 router hops | Simplification of the IP TTL |
| OSPF detection | loss of light / BFD 50 ms (assumption), or RouterDeadInterval 40 s; a restored link is seen at the next Hello (10 s) | Sourced timers (§3, RFC 2328 App. C.3); 50 ms is an assumption |
| OSPF LSA and SPF throttle | 50 ms initial each | Sourced (§3, Cisco doc 211432, "optimize enabled" defaults) |
| OSPF per-hop LSA processing, SPF run time | 2 ms, 2 ms | Assumption |
| OSPF cost | 100 Tbps ÷ link capacity (auto-cost reference bandwidth) | Method sourced (RFC 2328 leaves cost to the operator; auto-cost is vendor practice); reference value is an assumption |
| OSPF time compression | 100 ms of OSPF time per wall second; 10 s per wall second while only a long timer is pending | Modelling choice |
| BGP decision and export | LOCAL_PREF own > customer > peer > provider; shortest AS path; lowest neighbour ASN; valley-free export | Sourced (§3, RFC 4271 §9.1; Gao 2001; Gao & Rexford 2001) |
| BGP MRAI | 30 s × U(0.75, 1) per session; withdrawals sent at once | Sourced timer (§3, RFC 4271 §10); immediate withdrawals are a simplification |
| BGP session delay | 500 ms per hop | Assumption |
| AS model | 7 Pakistani ASes, PCCW 3491, Level3 3356, Arelion 1299, Cogent 174, YouTube 36561, 3 aggregated world regions (private ASNs 64601–64603) | ASNs sourced (§2); relationships inferred by CAIDA (§2); carrier peering mesh, YouTube's 2008 upstreams and world regions are assumptions |
| 2008 filters | Level3, Arelion, Cogent filter PTCL's announcements; PCCW does not | Matches the observed first path "3491 17557" (§1.7); the other carriers' filters are inferred from that |
| ROA for the what-if | 208.65.152.0/22, maxLength 22, origin AS36561 | What-if: RPKI did not exist in 2008; today the /22 has ROAs (§0 #10) |
| YouTube traffic volumes | world 2 Tbps, Pakistan 0.4 Tbps | Illustrative |
| BGP time compression | 20 s of BGP time per wall second; 10 min per wall second while only scenario actions are waiting | Modelling choice |
| Defence loop | Monitor → Analyse → Plan → Execute over Knowledge | Sourced framing (§3, Kephart & Chess 2003); see §4 for the link to the instructor's work |
| Volume detector | EWMA (α 0.1) of each protected destination's inbound rate; alarm at z ≥ 6 and ≥ 200 Gbps; learns only from normal windows | Method sourced (§3, EWMA / z-score); thresholds are assumptions |
| Source-entropy detector | Shannon entropy of the sources sending to a destination; alarm at a rise ≥ 1 bit over baseline | Method sourced (§3, Lakhina et al. 2005); 1 bit is an assumption (sources are ingress points and cities, not addresses) |
| Beacon detector | coefficient of variation of the gaps between connections ≤ 0.15 over 12 gaps | Assumption (random arrivals give ≈ 1) |
| Telemetry window, decision delay | 0.5 ms and 0.5 ms of network time | Assumption |
| ROV deployment after detection | 5 minutes of BGP time | Assumption |
| Attack volumes | DDoS 8 Tbps on the cables + 0.8 Tbps botnet; beacons every 0.1 ms of network time | Illustrative |
| Microwave backup chain | one logical RIP hop | Modelling choice: keeps the network within RIP's 15-hop limit |
| Peak offered load | 18 Tbps (all classes) | Assumption, chosen so peak international use (~6.6 Tbps busier direction) matches Dawn's 7–8 Tbps used (§0 #9) |
| Traffic classes | international 62%, domestic 19%, CDN 12%, China 1.5%, land borders 1%, satellite 0.2% | Assumption |
| Choice of city | ∝ population (gravity model) | Sourced method (§3, Roughan 2005) |

**What the step-3 model measured** (headless test runs, `tests/traffic.test.js`): at 21:00, about 6.6 Tbps of international traffic in the busier direction, ~0.2% loss (rural microwave hops), and a Karachi–Lahore–Karachi RTT of about 17 ms. With every Karachi cable cut, only the 0.45 Tbps China fibre and the land borders remain and loss exceeds 30%. An 8 Tbps flood saturates a data-centre uplink and raises loss to about 11%; diverting it to the scrubbing centre relieves the uplink.

## Source list

All web pages were accessed 21 Nov 2026. "(live)" means a database or API that changes over time.

**Cables, capacity, landing**
- S01 — Submarine Networks, "Pakistan" (cable landing stations page), no date (footer © 2011–2024). https://www.submarinenetworks.com/en/stations/asia/pakistan
- S02 — TeleGeography, Submarine Cable Map API, country "pakistan" (live). https://www.submarinecablemap.com/api/v3/country/pakistan.json
- S03 — TeleGeography, Submarine Cable Map API, "Africa-1" (live). https://www.submarinecablemap.com/api/v3/cable/africa-1.json
- S04 — TeleGeography, Submarine Cable Map API, "SeaMeWe-6" (live). https://www.submarinecablemap.com/api/v3/cable/seamewe-6.json
- S05 — TeleGeography, Submarine Cable Map API, "PEACE Cable" (live). https://www.submarinecablemap.com/api/v3/cable/peace-cable.json
- S06 — Submarine Networks, "PTCL Lands Africa-1 Subsea Cable in Karachi, Pakistan", 3 Mar 2025. https://www.submarinenetworks.com/en/systems/asia-europe-africa/africa-1/ptcl-lands-africa-1-subsea-cable-in-karachi-pakistan
- S07 — Associated Press of Pakistan (APP), "PTCL brings Africa-1 submarine cable to Pakistan, boosting country's digital future", 22 Feb 2025 (news). https://www.app.com.pk/national/ptcl-brings-africa-1-submarine-cable-to-pakistan-boosting-countrys-digital-future/
- S08 — Transworld Associates, press release "A Historic Moment For Pakistan!", 27 Feb 2025. https://www.tw1.com/press-release/a-historic-moment-for-pakistan/
- S09 — APP, "PTA shares update on 2Africa Submarine Cable System in Pakistan", 24 Dec (2024, year inferred) (news, PTA statement). https://www.app.com.pk/national/pta-shares-update-on-2africa-submarine-cable-system-in-pakistan/
- S10 — Transworld Associates, press release "Transworld (TWA) Announces Landing Of Another Subsea Cable SEA-ME-WE 6 In Pakistan", 22 Feb 2024. https://www.tw1.com/press-release/transworld-twa-announces-landing-of-another-subsea-cable-sea-me-we-6-in-pakistan/
- S11 — Transworld Associates, Press Releases index (latest item 24 Dec 2025). https://www.tw1.com/press-release/
- S12 — Dawn, "New internet cable lands in Pakistan, to boost connectivity", 22 Nov 2025 (news). https://www.dawn.com/news/1956718
- S13 — Express Tribune, "Consumers to see faster internet, improved connectivity as new cable lands in Pakistan", 22 Nov 2025 (news). https://tribune.com.pk/story/2578626/Consumers-to-see-faster-internet,-improved-connectivity-as-new-cable-lands-in-Pakistan
- S14 — Profit (Pakistan Today), "Pakistan activates SEA-ME-WE 6 cable to boost international internet capacity", 22 Nov 2025 (news). https://profit.pakistantoday.com.pk/2025/11/22/pakistan-activates-sea-me-we-6-cable-to-boost-international-internet-capacity/
- S15 — Express Tribune, "New subsea cable to boost Pak bandwidth", 23 Nov 2025 (news). https://tribune.com.pk/story/2578690/new-subsea-cable-to-boost-pak-bandwidth
- S16 — ProPakistani, "Pakistan is Now Officially Connected to One of the World's Fastest Undersea Cables", 22 Nov 2025 (news). https://propakistani.pk/2025/11/22/pakistan-is-now-officially-connected-to-one-of-the-worlds-fastest-undersea-cables/
- S17 — TechJuice, "Why Internet in Pakistan May Slow Down This Week" (date not shown; ~Apr 2026 inferred) (news). https://www.techjuice.pk/pakistani-internet-users-brace-for-four-day-slowdown-as-submarine-cable-goes-under-maintenance/
- S18 — TechJuice, "Pakistan's International Internet Capacity Hits 17 Tbps; New Submarine Cables in Pipeline" (date not shown; ~late 2025 inferred) (news, citing PTA). https://www.techjuice.pk/pakistans-international-internet-capacity-hits-17-tbps-new-submarine-cables-in-pipeline/
- S19 — PACRA (Pakistan Credit Rating Agency), "Telecommunication — Sector Study", 21 Jul 2026, p. 25. https://www.pacra.com/view/storage/app/Telecommunication-%20PACRA%20Research%20-%20Jul'26%201_1784631941.pdf
- S20 — Dawn (Kalbe Ali), "Internet slowdown expected due to cable fault near Qatar: PTA", 3 Jan 2025 (news). https://www.dawn.com/news/1882770
- S21 — Dawn (Kalbe Ali), report on AAE-1 recovery and traffic shift, 5 Jan 2025 (news). https://www.dawn.com/news/1883187
- S22 — Submarine Networks, "AAE-1" system page. https://www.submarinenetworks.com/en/systems/asia-europe-africa/aae-1
- S23 — Submarine Networks, "SMW5" system page. https://www.submarinenetworks.com/en/systems/asia-europe-africa/smw5
- S24 — Submarine Networks, "IMEWE" system page. https://www.submarinenetworks.com/en/systems/asia-europe-africa/imewe
- S25 — Submarine Networks, "SMW4" system page. https://www.submarinenetworks.com/en/systems/asia-europe-africa/smw4

**Pak-China OFC**
- S26 — Dawn, "Land-based communication link with China opened", 14 Jul 2018 (news, quoting SCO DG). https://www.dawn.com/news/1419971
- S27 — Express Tribune, "Pak-China fibre optic link activated for commercial use", 1 Feb 2019 (news). https://tribune.com.pk/story/1901975/1
- S28 — AidData, China's Global Development Footprint, Project 39015 "Pak-China Fiber Optic Cable Construction Project". https://china.aiddata.org/projects/39015
- S29 — Daily Times, "ECNEC approves Rs 37.9bn second phase of Pak-China optical fiber cable project", 24 Jan 2021 (news). https://dailytimes.com.pk/716538/ecnec-approves-rs-37-9bn-second-phase-of-pak-china-optical-fiber-cable-project/
- S30 — ProPakistani, "Pakistan and China to Increase Telecom Traffic With New Optic Fiber Connections", 7 Mar 2022 (news). https://propakistani.pk/2022/03/07/pakistan-and-china-to-increase-telecom-traffic-with-new-optic-fiber-connections/

**Exchanges**
- S31 — APNIC Blog (Robbie Mitchell), "PKIX launches third IXP", 16 Aug 2022. https://blog.apnic.net/2022/08/16/pkix-launches-third-ixp/
- S32 — Internet Society (Aftab Siddiqui), "Why Is So Much Internet Traffic Leaving Pakistan?", 9 Apr 2020. https://www.internetsociety.org/blog/2020/04/why-is-so-much-internet-traffic-leaving-pakistan/
- S33 — PeeringDB API, IXs in Pakistan (live). https://www.peeringdb.com/api/ix?country=PK
- S34 — PeeringDB API, networks at PIE Karachi (ix 4271) (live). https://www.peeringdb.com/api/netixlan?ix_id=4271
- S35 — DE-CIX, "Karachi" location page. https://www.de-cix.net/en/locations/karachi
- S36 — Internet Society Pulse, IXP Tracker: Pakistan (data Nov 2026). https://pulse.internetsociety.org/en/ixp-tracker/country/pk/

**PakSat-MM1**
- S37 — SUPARCO, "PAKSAT-MM1". https://suparco.gov.pk/major-programmes-satellite-programs/paksat-mm1.html
- S38 — PAKSAT International, "PAKSAT-MM1". https://paksat.com.pk/paksat-mm1/
- S39 — China Great Wall Industry Corp. (CGWIC), launch news, 30 May 2024. https://cgwic.com/News/2024/20240530.html
- S40 — SatNews, "Kacific, PAKSAT partner to deliver affordable satellite internet to Pakistan", 10 Mar 2025. https://satnews.com/2025/03/10/kacific-paksat-partner-to-deliver-affordable-satellite-internet-to-pakistan/
- S41 — Satbeams, "Paksat-MM1 at 38°E". https://satbeams.com/satellites/2786-paksat-mm1

**BGP data and 2008 hijack**
- S42 — RIPE NCC, "YouTube Hijacking: A RIPE NCC RIS case study", 17 Mar 2008. https://www.ripe.net/publications/news/industry-developments/youtube-hijacking-a-ripe-ncc-ris-case-study
- S43 — Renesys blog (Martin A. Brown), "Pakistan hijacks YouTube", 24 Feb 2008. Read via a University of Waterloo course mirror, because the original renesys.com page is gone: https://crysp.uwaterloo.ca/courses/cs458/F08-lectures/local/www.renesys.com/blog/2008/02/pakistan_hijacks_youtube_1.shtml.html
- S44 — RIPE NCC RIPEstat: prefix-overview 208.65.152.0/22; rpki-validation AS36561/208.65.152.0/22; announced-prefixes AS36561 (queried 21 Nov 2026, live). https://stat.ripe.net/data/prefix-overview/data.json?resource=208.65.152.0/22 · https://stat.ripe.net/data/rpki-validation/data.json?resource=AS36561&prefix=208.65.152.0/22 · https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS36561
- S45 — RIPE NCC RIPEstat, as-overview (one query per ASN, live). https://stat.ripe.net/data/as-overview/data.json?resource=AS17557 (and the same URL with each ASN listed in §2.1)
- S46 — CAIDA AS Rank API v2 (GraphQL), dataset 2026-11-01 (live). https://api.asrank.caida.org/v2/graphql
- S47 — PeeringDB API, network records (live). https://www.peeringdb.com/api/net?asn__in=9541,38193,18053,45669,58470,24499,59257,55356,38264,23674,9260,17557

**Incidents**
- S48 — A. Popescu, B. J. Premore, E. Zmijewski (Renesys), "Middle East Meltdown: A Global BGP Perspective", APRICOT 2008, Feb 2008 (slides). https://conference.apnic.net/25/program/apops1/earl-fiber-cut-analysis.pdf
- S49 — RIPE NCC, "Mediterranean Fibre Cable Cut" (archived project; covers Jan–Feb 2008). https://www.ripe.net/analyse/archived-projects/mediterranean-fibre-cable-cut/
- S50 — Kentik (Doug Madory), "What caused the Red Sea submarine cable cuts?", 31 Mar 2024. https://kentik.com/blog/what-caused-the-red-sea-submarine-cable-cuts
- S51 — Kentik (Doug Madory), "Subsea Cables Parted in Red Sea Again", 9 Sep 2025. https://www.kentik.com/blog/subsea-cables-parted-in-red-sea-again
- S52 — ProPakistani, "Document Exposes Real Culprit Behind Internet Disruptions in Pakistan This Year", 25 Oct 2024 (news). https://propakistani.pk/2024/10/25/document-exposes-real-culprit-behind-internet-disruptions-in-pakistan-this-year/
- S53 — Dawn, "ISP says its internet services will be fully restored across country by Monday", 24 Oct 2025 (news; StormFiber statement). https://www.dawn.com/news/1950976
- S54 — Engineering at Meta (Santosh Janardhan), post-mortem of the 4 Oct 2021 outage, 5 Oct 2021. https://engineering.fb.com/2021/10/05/networking-traffic/outage-details/
- S55 — Cloudflare Blog (Celso Martinho, Tom Strickx), "Understanding how Facebook disappeared from the Internet", 4 Oct 2021. https://blog.cloudflare.com/october-2021-facebook-outage/
- S56 — Cloudflare Blog (Tom Strickx), "How Verizon and a BGP Optimizer Knocked Large Parts of the Internet Offline Today", 24 Jun 2019. https://blog.cloudflare.com/how-verizon-and-a-bgp-optimizer-knocked-large-parts-of-the-internet-offline-today/
- S57 — R. Hiran, N. Carlsson, P. Gill, "Characterizing Large-scale Routing Anomalies: A Case Study of the China Telecom Incident", PAM 2013 (peer-reviewed). Author PDF: https://www.ida.liu.se/~nikca89/papers/pam13.pdf · Citizen Lab summary, 17 Dec 2012: https://citizenlab.ca/2012/12/characterizing-large-scale-routing-anomalies-a-case-study-of-the-china-telecom-incident/
- S57b — Daily Times, "Submarine cable cuts disrupt internet services across Pakistan", 6 Sep 2025 (news; PTCL statement). https://dailytimes.com.pk/1364977/submarine-cable-cuts-disrupt-internet-services-across-pakistan/
- S58 — Cloudflare Blog (Louis Poinsignon), "BGP leaks and cryptocurrencies", 24 Apr 2018. https://blog.cloudflare.com/bgp-leaks-and-crypto-currencies
- S59 — APNIC Blog (Massimo Candela, with Emile Aben; originally RIPE Labs), "A quick look at the attack on Dyn", 26 Oct 2016. https://blog.apnic.net/2016/10/26/quick-look-attack-dyn/
- S60 — M. Antonakakis et al., "Understanding the Mirai Botnet", USENIX Security 2017, pp. 1093–1110 (peer-reviewed). https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/antonakakis
- S61 — SANS Internet Storm Center (Johannes Ullrich), diary 22350 "BGP Hijacking: The Internet is Still/Again Broken", 27 Apr 2017. https://isc.sans.edu/diary/22350
- S62 — Muhammad Idrees Afzal (Telenor Pakistan), "Effect of Fiber Cut in Pakistan", SANOG 6 (2005) (slides). https://www.sanog.org/resources/sanog6/idrees-pk-fibercut.pdf
- S63 — Dawn, "Internet system restored: PTCL", 9 Jul 2005 (news). https://www.dawn.com/news/147080
- S64 — Cloudflare Blog (João Tomé, David Belson), "Undersea cable failures cause Internet disruptions across Africa", 14 Mar 2024. https://blog.cloudflare.com/undersea-cable-failures-cause-internet-disruptions-across-africa-march-14-2024

**Protocol standards (RFC Editor, plain-text versions opened)**
- S70 — RFC 1058, C. Hedrick, "Routing Information Protocol", Jun 1988. https://www.rfc-editor.org/rfc/rfc1058.txt
- S71 — RFC 2453 (STD 56), G. Malkin, "RIP Version 2", Nov 1998. https://www.rfc-editor.org/rfc/rfc2453.txt
- S72 — RFC 2328 (STD 54), J. Moy, "OSPF Version 2", Apr 1998. https://www.rfc-editor.org/rfc/rfc2328.txt
- S73 — RFC 4271, Y. Rekhter, T. Li, S. Hares (eds.), "A Border Gateway Protocol 4 (BGP-4)", Jan 2006. https://www.rfc-editor.org/rfc/rfc4271.txt
- S74 — RFC 1812, F. Baker (ed.), "Requirements for IP Version 4 Routers", Jun 1995. https://www.rfc-editor.org/rfc/rfc1812.txt
- S75 — RFC 6480, M. Lepinski, S. Kent, "An Infrastructure to Support Secure Internet Routing", Feb 2012. https://www.rfc-editor.org/rfc/rfc6480.txt
- S76 — RFC 6811, P. Mohapatra et al., "BGP Prefix Origin Validation", Jan 2013. https://www.rfc-editor.org/rfc/rfc6811.txt
- S77 — RFC 8210, R. Bush, R. Austein, "The RPKI to Router Protocol, Version 1", Sep 2017. https://www.rfc-editor.org/rfc/rfc8210.txt
- S78 — RFC 7908, K. Sriram et al., "Problem Definition and Classification of BGP Route Leaks", Jun 2016. https://www.rfc-editor.org/rfc/rfc7908.txt
- S79 — RFC 9234, A. Azimov et al., "Route Leak Prevention and Detection Using Roles in UPDATE and OPEN Messages", May 2022. https://www.rfc-editor.org/rfc/rfc9234.txt
- S80 — RFC 7567 (BCP 197), F. Baker, G. Fairhurst (eds.), "IETF Recommendations Regarding Active Queue Management", Jul 2015. https://www.rfc-editor.org/rfc/rfc7567.txt
- S81 — RFC 2439, C. Villamizar, R. Chandra, R. Govindan, "BGP Route Flap Damping", Nov 1998. https://www.rfc-editor.org/rfc/rfc2439.txt
- S82 — RFC 7454 (BCP 194), J. Durand, I. Pepelnjak, G. Doering, "BGP Operations and Security", Feb 2016. https://www.rfc-editor.org/rfc/rfc7454.txt
- S83 — Cisco, Document 211432, "Change of Default OSPF and IS-IS SPF and Flooding Timers and iSPF Removal", updated 18 Jul 2018. https://www.cisco.com/c/en/us/support/docs/ip/ip-routing/211432-Change-of-Default-OSPF-and-IS-IS-SPF-and.html

**Papers and data sheets** (DOIs checked via the Crossref API, https://api.crossref.org/works/<DOI>)
- S90 — Corning, "Corning SMF-28e+ Optical Fiber" product information PI1463, issued Jun 2014 (read via an FS.com mirror). https://img-en.fs.com/file/datasheet/corning-smf-28eplus-33175.pdf
- S91 — A. Singla, B. Chandrasekaran, P. B. Godfrey, B. Maggs, "The Internet at the Speed of Light", ACM HotNets 2014, DOI 10.1145/2670518.2673876. PDF: https://people.eecs.berkeley.edu/~sylvia/cs268-2019/papers/speed.pdf
- S92 — I. N. Bozkurt et al., "Why Is the Internet so Slow?!", PAM 2017, LNCS pp. 173–187, DOI 10.1007/978-3-319-54328-4_13 (metadata only).
- S94 — G. Appenzeller, I. Keslassy, N. McKeown, "Sizing Router Buffers", ACM SIGCOMM 2004, pp. 281–292, DOI 10.1145/1015467.1015499. PDF: https://www.cs.princeton.edu/courses/archive/fall12/cos561/papers/buffer-sizing-sigcomm04.pdf
- S95 — L. Gao, "On Inferring Autonomous System Relationships in the Internet", IEEE/ACM ToN 9(6):733–745, Dec 2001, DOI 10.1109/90.974527 (metadata only).
- S96 — L. Gao, J. Rexford, "Stable Internet Routing Without Global Coordination", IEEE/ACM ToN 9(6):681–692, Dec 2001, DOI 10.1109/90.974523. PDF: https://www.cs.princeton.edu/~jrex/papers/ton01-stable.pdf
- S97 — J. O. Kephart, D. M. Chess, "The Vision of Autonomic Computing", IEEE Computer 36(1):41–50, Jan 2003, DOI 10.1109/MC.2003.1160055. PDF: http://jmvidal.cse.sc.edu/library/kephart03a.pdf
- S98 — A. Lakhina, M. Crovella, C. Diot, "Mining Anomalies Using Traffic Feature Distributions", ACM SIGCOMM 2005, pp. 217–228, DOI 10.1145/1080091.1080118. PDF: https://cs-web.bu.edu/fac/crovella/paper-archive/sigc05-mining-anomalies.pdf
- S99 — L. Feinstein, D. Schnackenberg, R. Balupari, D. Kindred, "Statistical Approaches to DDoS Attack Detection and Response", DARPA DISCEX 2003, pp. 303–314, DOI 10.1109/DISCEX.2003.1194894 (metadata only).
- S100 — S. W. Roberts, "Control Chart Tests Based on Geometric Moving Averages", Technometrics 1(3):239–250, 1959, DOI 10.1080/00401706.1959.10489860 (metadata only).
- S101 — NIST/SEMATECH e-Handbook of Statistical Methods, §6.3.2.4 "EWMA Control Charts". https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc324.htm
- S102 — M. Roughan, "Simplifying the Synthesis of Internet Traffic Matrices", ACM SIGCOMM CCR 35(5):93–96, 2005, DOI 10.1145/1096536.1096551. PDF: https://matthewroughan.netlify.app/papers/ccr_2005.pdf
- S103 — Y. Zhang, M. Roughan, N. Duffield, A. Greenberg, "Fast Accurate Computation of Large-Scale IP Traffic Matrices from Link Loads", ACM SIGMETRICS 2003, pp. 206–217, DOI 10.1145/781027.781053. PDF: https://www.cs.utexas.edu/~yzhang/papers/tomogravity-sigm03.pdf

**Instructor**
- S110 — NUST SEECS, faculty page "Maryam Sajjad". https://seecs.nust.edu.pk/faculty/maryam-sajjad/
- S111 — Google Scholar profile "Maryam Sajjad" (live). https://scholar.google.com/citations?user=o3bDyasAAAAJ&hl=en
- S112 — Lancaster University EPrints record 225594 (P2). https://eprints.lancs.ac.uk/id/eprint/225594/ · Crossref DOI 10.1007/s11036-019-01355-y
- S113 — Crossref DOI 10.1109/TETC.2018.2791459 (P1), with the abstract read through the Semantic Scholar API. https://api.semanticscholar.org/graph/v1/paper/DOI:10.1109/tetc.2018.2791459?fields=title,abstract
- S114 — Crossref DOI 10.1109/CIACS.2015.7395569 (P3).
- S115 — Crossref DOI 10.1109/ICDIM.2013.6693986 (P4).

**Pages I tried but could not open** (not used as the basis for any status)
- PID press release 31076 (MoITT on SMW6): certificate error.
- Business Recorder 40060743 (OFC Phase II): HTTP 403.
- ThousandEyes Rostelecom post: HTTP 403.
- bgpmon.net (Rostelecom; China Telecom): connection refused.
- NANOG 34 Underwood/Renesys TTNet slides: HTTP 402.
- dyn.com blog: not reachable.
- CRTC / Xona Rogers report: HTTP 403; the publications.gc.ca copy shows only an "archived" stub.
- CBC Rogers story: HTTP 403.
- ACM DL profile for M. Sajjad: HTTP 403.
- NUML faculty page and the SEECS publications page: certificate errors.
- Lyngsat PakSat-MM1: HTTP 403.
- Al Jazeera, 7 Sep 2025: connection reset.
- Corning SMF-28 Ultra sheets on corning.com: HTTP 403; the SMF-28e+ sheet S90 was used instead.
- Springer page for P2: login redirect.

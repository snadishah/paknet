// Build the course report (docs/PAKNET-report.docx) from docs/REFERENCES.md,
// docs/results/results.json and the figures.   npm run report
// (runs the experiments and the charts first; see package.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType,
  ImageRun, AlignmentType, PageBreak, LevelFormat, Footer, PageNumber, BorderStyle, TableOfContents, ExternalHyperlink
} from 'docx';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const md = readFileSync(join(root, 'docs/REFERENCES.md'), 'utf8');
const R = JSON.parse(readFileSync(join(root, 'docs/results/results.json'), 'utf8'));
const FONT = 'Arial', W = 9026; // A4 width minus 1-inch margins, in DXA

/* ---------- reading REFERENCES.md ---------- */
const clean = s => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\[(S\d+[a-z]?)\]/g, '$1').trim();
function tableAfter(heading) {
  const i = md.indexOf(heading); if (i < 0) throw new Error('missing ' + heading);
  const lines = md.slice(i).split(/\r?\n/); const rows = []; let started = false;
  for (const l of lines.slice(1)) {
    if (l.startsWith('|')) { started = true; if (/^\|\s*-/.test(l)) continue; rows.push(l.split('|').slice(1, -1).map(c => clean(c))); }
    else if (started) break;
  }
  return rows;
}
function sources() {
  const part = md.slice(md.indexOf('## Source list')); const out = [];
  for (const l of part.split(/\r?\n/)) { const m = l.match(/^- (S\d+[a-z]?) — (.+)$/); if (m) out.push([m[1], clean(m[2])]); }
  return out;
}

/* ---------- building blocks ---------- */
const P = (text, o = {}) => new Paragraph({ spacing: { after: 120 }, ...o, children: runs(text, o.run) });
// **bold** inside text becomes a bold run
function runs(text, base = {}) { return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(t => t.startsWith('**') ? new TextRun({ text: t.slice(2, -2), bold: true, ...base }) : new TextRun({ text: t, ...base })); }
const H1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const bullet = t => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 60 }, children: runs(t) });
const caption = t => new Paragraph({ spacing: { before: 60, after: 200 }, children: [new TextRun({ text: t, italics: true, size: 18, color: '52514E' })] });
// a chart from docs/results, or a screenshot from docs/evidence (jpg)
const figure = (file, w = 600, h = 230) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, keepNext: true, children: [new ImageRun({ type: file.endsWith('.jpg') ? 'jpg' : 'png', data: readFileSync(join(root, file.includes('/') ? file : join('docs/results', file))), transformation: { width: w, height: h } })] });
const shot = f => figure('docs/evidence/round3/' + f, 600, 375);
function table(header, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0), scale = W / total, cols = widths.map(w => Math.round(w * scale));
  cols[cols.length - 1] += W - cols.reduce((a, b) => a + b, 0);
  const cell = (t, i, head) => new TableCell({
    width: { size: cols[i], type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 90, right: 90 },
    shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: 'E6F0EA' } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text: String(t ?? '—'), bold: head, size: 18 })] })]
  });
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: cols, rows: [new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, i, true)) }), ...rows.map(r => new TableRow({ children: r.map((c, i) => cell(c, i, false)) }))] });
}
const gap = () => new Paragraph({ spacing: { after: 120 }, children: [] });

/* ---------- numbers used in the text ---------- */
const cut = l => R.cuts.find(c => c.label.startsWith(l));
const dd = R.defence.ddos, rip = R.rip;
const ospfC = R.ospf.filter(o => o.detect === 'carrier'), ospfH = R.ospf.filter(o => o.detect === 'hello');
const range = a => `${Math.round(Math.min(...a))}–${Math.round(Math.max(...a))}`;
const adaptive = R.hijack.fixes.find(f => f.label.startsWith('Adaptive'));

/* ---------- the document ---------- */
const body = [
  // title page
  new Paragraph({ spacing: { before: 2400, after: 200 }, children: [new TextRun({ text: 'PAKNET', bold: true, size: 64, font: FONT, color: '2F6F53' })] }),
  new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: 'Simulating Pakistan\'s internet: traffic, routing protocols, failures and an adaptive defence', size: 32 })] }),
  P('Computer Networks course project · School of Electrical Engineering and Computer Science (SEECS), NUST'),
  P('Instructor: Ms. Maryam Sajjad'),
  P('Prepared by: [names and registration numbers]'),
  P('November 2026'),
  new Paragraph({ children: [new PageBreak()] }),
  new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }),
  new Paragraph({ children: [new PageBreak()] }),

  H1('1. Introduction'),
  P('Almost all of Pakistan\'s international internet traffic leaves through submarine cables that land on one stretch of coast near Karachi. That makes the country a clear case study for a networks course: a single point of failure, a handful of operators, a national backbone along the highways, and a well-documented history of incidents, from cable cuts to the 2008 YouTube hijack that started in Pakistan.'),
  P('PAKNET is an interactive three.js simulation of that network, shown on a 3D globe that zooms from space down to a street in Karachi. It began as a visual proof of concept with scripted behaviour. This report describes the version in which the behaviour is simulated: traffic moves as discrete events through links with real capacity, delay and queues; OSPF, RIP and BGP run as protocols; and an adaptive defence detects and answers attacks. Every number the app shows is measured from the simulation, and every fact and parameter is traced to a source or labelled as an assumption in the project\'s reference document (docs/REFERENCES.md).'),

  H1('2. Method'),
  H2('2.1 Geography and topology'),
  P('Borders and coastline come from Natural Earth (10 m); province shapes from the Highcharts map collection, fitted to the detailed Natural Earth outline; city positions and populations from GeoNames (443 places). The network graph has core and aggregation routers in the main cities, five cable landing stations, internet exchanges (PKIX sites and PIE Karachi), content caches, the Pak-China fibre with its microwave backup chain, PakSat-MM1 and land links to Afghanistan, Iran and China.'),
  P('**The internal topology is representative, not real.** Pakistani operators do not publish their networks. Corridors follow motorways and national highways, and which operators run each corridor is illustrative. Cable landings, exchanges, the China link and the satellite follow the public record (section 3).'),
  H2('2.2 Traffic as discrete events'),
  P('Every directed link has a capacity, a propagation delay (distance × 5 µs/km × a route factor of 1.5) and a FIFO buffer holding 5 ms of line rate, with tail drop. A moving dot is a bundle of 0.1 Gbit: simulating terabits per second packet by packet is not possible in a browser. A bundle waits in the outgoing queue, is transmitted (size ÷ capacity) and propagates; cutting a link loses whatever is queued, transmitting or on the wire. Offered load follows the time of day (18 Tbps at the evening peak), end points are chosen by population (a gravity model), and international traffic leaves on its operator\'s own cables. Tiny probe bundles measure the Karachi–Lahore round trip. Time runs in slow motion: 2 ms of network time per second on screen.'),
  P('Measured, not computed: capacity of the usable international links; throughput in the busier direction (capacity is quoted per direction); loss of legitimate traffic; round-trip time; link and cable utilisation (share of time transmitting); queue occupancy.'),
  H2('2.3 Routing protocols'),
  bullet('**OSPF (link state, the default).** Each router keeps its own link-state database. A failure is noticed by loss of light (about 50 ms) or when Hellos stop (the 40 s dead interval, RFC 2328). The routers next to it originate new LSAs, which flood hop by hop; each router reruns Dijkstra after the SPF throttle (50 ms, current Cisco default) and installs its own table. Traffic follows each router\'s own table, so routers that have not heard yet send traffic into the dead link.'),
  bullet('**RIP (distance vector).** Synchronous rounds of whole-table exchange, hop-count metric, infinity 16, optional split horizon and poison reverse (RFC 2453). One round stands for RIP\'s 30 s timer. Traffic follows next hops, so loops expire by TTL.'),
  bullet('**BGP.** Sixteen autonomous systems: seven Pakistani operators, four international carriers, YouTube, Facebook and three aggregated world regions, with relationships inferred by CAIDA. Preference customer > peer > provider, shortest AS path, valley-free export (Gao–Rexford), MRAI 30 s (RFC 4271), optional customer prefix filters and RPKI origin validation (RFC 6811), longest-prefix-match forwarding.'),
  H2('2.4 Adaptive defence'),
  P('The defence is a MAPE-K loop (Kephart and Chess, 2003). Monitor: flow telemetry of every bundle as it enters the network, and BGP routes seen from the carriers and world regions. Analyse: an EWMA z-score on each protected destination\'s inbound volume, the entropy of where that traffic comes from (after Lakhina et al., 2005), the regularity of connection gaps (beaconing) and RPKI origin validation. Plan and Execute: divert traffic to a scrubbing centre, quarantine devices with step-up authentication, or ask the carriers to deploy origin validation. No timer decides anything; with the defence off, the same attack goes unanswered.'),
  H2('2.5 The 3D globe'),
  P('The network is drawn on a globe in real coordinates (kilometres, Earth-centred). From space it shows NASA\'s Blue and Black Marble images with the day–night line at the real time; below about 1,500 km it cross-fades to satellite photographs (Esri World Imagery with a key, Sentinel-2 cloudless without one), sharp down to street level. The simulator\'s flat topology is mapped onto the globe at draw time only, so lengths and delays in the model are unchanged.'),
  bullet('**Cables to real landing points.** The nine submarine cables follow their TeleGeography routes (CC BY-NC-SA 3.0) from Karachi to Marseille, Toulon, Penmarch, Singapore, Hong Kong, Mumbai, Mombasa and Fujairah; the land links continue along the roads to Kashgar, Kabul, Kandahar and Zahedan. Parcels ride on to the destination at the cable\'s own speed.'),
  bullet('**Representative 3D models, built in code.** Landing stations, internet exchanges, data centres, satellite ground stations aimed at PakSat-MM1, telecom exchanges, the KKH microwave towers, the Khunjerab border post, the five illustrative offices with a network room whose rack lights follow live traffic, and PakSat-MM1 and the retired PakSat-1R (shown enlarged from far away, true size up close). City buildings, streets, trees, lamps and parked cars come from OpenStreetMap around each office. Every model is labelled representative; nothing is a licensed third-party asset.'),
  bullet('**Light and close-up detail.** Filmic tone mapping, soft sun shadows near the ground, building windows lit at night, fibre trenches with marker posts beside the roads.'),
  H2('2.6 Presentation and verification'),
  P('Ten scenarios replay real incidents (the 2008 YouTube hijack, the January 2025 AAE-1 fault, the 2025 Red Sea cuts, a landslide on the Karakoram Highway, the 2021 Facebook withdrawal) and illustrative attack and routing cases, with each step acting on the live simulation; cuts are marked in 3D at the real fault positions. "Watch the story" plays a 15-chapter film with captions that needs no input, and a short tour introduces the controls. The code has 163 automated tests (Vitest). A headless browser check (npm run verify) opens the app at laptop and phone size and checks start-up time, draw calls (at most 150), console errors, a continuous zoom from space to the street, every scenario and the whole film; a layout audit (scripts/ui-audit.mjs) visits 26 states at four laptop sizes and reports any text that overlaps, is cut off or leaves the window. The results in section 4 come from a headless script with seeded random numbers, so they are repeatable (npm run experiment).'),

  H1('3. Assumptions and sources'),
  P('docs/REFERENCES.md checks every fact against primary sources (operators, regulators, registries, RFCs, incident post-mortems, papers) and records the source of every model parameter. Table 1 lists the items whose status affects what the app shows; Table 2 lists the parameters of the model.'),
  caption('Table 1. Facts that were corrected, are unverified or are conflicting (from REFERENCES §0).'),
  table(['Item', 'Status', 'Sources'], tableAfter('## 0. Summary').map(r => [r[1], r[2], r[4]]), [5, 2, 1.4]),
  gap(),
  caption('Table 2. Model parameters, with the basis for each (from REFERENCES §7).'),
  table(['Parameter', 'Value', 'Basis'], tableAfter('## 7. Simulation parameters').map(r => [r[0], r[1], r[2]]), [2.2, 3, 3]),

  H1('4. Results'),
  P('All runs use seed 42 and the evening peak (21:00) unless stated. Times inside the network are network time; on screen they run 500 times slower.'),
  H2('4.1 A normal day'),
  figure('fig1_daily.png', 600, 217),
  caption('Figure 1. International traffic and loss over a day.'),
  table(['Hour', 'International traffic (Tbps)', 'Loss (%)', 'Karachi–Lahore RTT (ms)'], R.daily.map(d => [d.hour, d.intlTbps, d.lossPct, d.rttMs]), [1, 2, 1.2, 2]),
  P(`At the evening peak the model carries about ${R.daily.at(-1).intlTbps} Tbps of international traffic in the busier direction, close to the 7–8 Tbps Dawn reported in use in January 2025, on ${cut('No cuts').capTbps} Tbps of lit capacity. Loss stays below half a per cent, almost all of it on rural microwave links at peak. The Karachi–Lahore round trip is about ${R.daily.at(-1).rttMs} ms, nearly all propagation.`),
  H2('4.2 Cable cuts'),
  figure('fig2_cuts.png', 600, 250),
  caption('Figure 2. Capacity, traffic carried and loss for each cut at 21:00.'),
  table(['Case', 'Capacity (Tbps)', 'Carried (Tbps)', 'Loss (%)'], R.cuts.map(c => [c.label, c.capTbps, c.intlTbps, c.lossPct]), [3.2, 1.3, 1.3, 1]),
  P(`Losing AAE-1 removes 3.6 Tbps and raises loss to ${cut('AAE-1 (Jan').lossPct}%: PTCL's users must fit onto PTCL's remaining cables. Switching IMEWE and SMW4 to their installed capacity, as PTCL did, brings loss back to ${cut('AAE-1 +').lossPct}%, matching PTA's report that most of the shortfall was recovered within two days. The September 2025 double cut is the worst single-operator case (${cut('SMW4 +').lossPct}%). PEACE alone barely shows, because Cybernet also buys transit from PTCL and TWA. Losing every Karachi cable leaves only the 0.45 Tbps China fibre and the land borders: loss reaches ${cut('Every').lossPct}%.`),
  P('An earlier version of the model let any operator\'s traffic use any cable; losing AAE-1 then cost only 0.2% loss. Routing international traffic by operator was the change that made the model agree with what happened.'),
  H2('4.3 RIP and count-to-infinity'),
  figure('fig3_rip.png', 600, 233),
  caption('Figure 3. Nok Kundi\'s hop count to Taftan after the Nok Kundi–Taftan link is cut.'),
  P(`Cutting Nok Kundi–Taftan leaves Taftan and the Iran link with no other path. Without split horizon, Nok Kundi and its neighbours accept each other's stale routes and count 3, 5, 7 … 15 before reaching 16, after ${rip.none.roundsToConverge} rounds (about ${Math.round(rip.none.roundsToConverge * 0.5)} minutes of RIP time). Split horizon and poison reverse stop the two-router bounce at once, but a stale route still travels round a larger loop through Quetta, Mastung and Sibi and comes back as 14 and 15 before dying: here they do not shorten convergence (${rip.splitHorizon.roundsToConverge} rounds). This is the known limit of split horizon in loops of three or more routers. While the routers count, traffic for Iran loops between Nushki and Kharan and jams that microwave link before its TTL expires.`),
  H2('4.4 OSPF convergence'),
  figure('fig4_ospf.png', 600, 233),
  caption('Figure 4. OSPF convergence time and traffic lost before convergence.'),
  table(['Failure', 'Detection', 'Converged (ms)', 'Flooding (ms)', 'Routers', 'Bundles lost'], R.ospf.map(o => [o.label, o.detect === 'carrier' ? 'loss of light' : 'dead interval', o.totalMs, o.floodMs, o.routers, o.blackholedBundles]), [2.4, 1.6, 1.4, 1.2, 0.9, 1.1]),
  P(`With loss-of-light detection, every failure converges in ${range(ospfC.map(o => o.totalMs))} ms: 50 ms detection, ${range(ospfC.map(o => o.floodMs))} ms of LSA flooding across the country, and the SPF throttle. Waiting for the dead interval adds 40 s. Until each router installs its new table it keeps sending traffic into the dead link; on the Karachi–Hyderabad trunk that costs ${ospfC.find(o => o.label.startsWith('Karachi')).blackholedBundles} bundles with fast detection and ${ospfH.find(o => o.label.startsWith('Karachi')).blackholedBundles} while waiting for Hellos.`),
  H2('4.5 The 2008 YouTube hijack'),
  figure('fig5_hijack.png', 600, 233),
  caption('Figure 5. Share of users whose YouTube traffic ended in Pakistan, after each event of 24 February 2008.'),
  table(['UTC', 'Event', 'World hijacked', 'Pakistan blocked'], R.hijack.replay.map(r => [r.utc, r.step, Math.round(r.world * 100) + '%', Math.round(r.pakistan * 100) + '%']), [1, 3, 1.3, 1.3]),
  P(`Only the operator actions of the day are scripted. From BGP alone: PTCL's /24 leaks only through PCCW (the other carriers filter it); it reaches every world region in ${Math.round(R.hijack.leak.convergenceMs / 1000)} s of BGP time with ${R.hijack.leak.updates} updates; longest-prefix match sends all YouTube traffic to Pakistan. When YouTube announces the same /24, only the networks behind PCCW stay hijacked (25%), because PCCW prefers its customer's route: the partial recovery seen that evening. YouTube's /25s end it.`),
  caption('Table 3. What would have prevented it.'),
  table(['Measure', 'World hijacked', 'Pakistan blocked'], R.hijack.fixes.map(f => [f.label + (f.containedUtc ? ` (contained at ${f.containedUtc} UTC)` : ''), Math.round(f.world * 100) + '%', Math.round(f.pakistan * 100) + '%']), [4, 1.3, 1.3]),
  P(`Any one of PTCL's export filter, a customer prefix filter at PCCW, or origin validation at the carriers keeps the world unaffected; only Pakistan, which ordered the block, loses YouTube. With the adaptive defence, the leak is detected the moment it appears at PCCW and contained at ${adaptive.containedUtc} UTC, about six minutes instead of about two hours. RPKI did not exist in 2008; YouTube's prefix has origin records today, so this is a what-if with today's rules.`),
  H2('4.6 The adaptive defence'),
  figure('fig6_ddos.png', 600, 233),
  caption('Figure 6. Loss of legitimate traffic during an 8 Tbps flood on the Lahore CDN edge.'),
  table(['', 'Defence off', 'Defence on'], [['Detected after (network ms)', '—', dd.on.detectMs], ['Diverted after (network ms)', '—', dd.on.responseMs], ['Peak loss (%)', dd.off.peakLossPct, dd.on.peakLossPct], ['Average loss (%)', dd.off.meanLossPct, dd.on.meanLossPct]], [3, 1.5, 1.5]),
  P(`The loop detects the flood ${dd.on.detectMs} ms of network time after it begins, from a volume z-score and a jump in source entropy, and diverts it to the scrubbing centre at ${dd.on.responseMs} ms. Peak loss falls from ${dd.off.peakLossPct}% to ${dd.on.peakLossPct}% and average loss from ${dd.off.meanLossPct}% to ${dd.on.meanLossPct}%. Loss does not fall to zero: the flood still crosses the submarine cables to reach Karachi, so scrubbing on land cannot relieve congestion on the cables themselves; that would need scrubbing upstream, abroad.`),
  P(`Compromised phones beaconing every 0.1 ms of network time were detected after ${R.defence.beacon.detectMs} ms (gap variation near 0%) and quarantined. Over ${R.defence.falsePositives.networkMs} ms of a normal evening with the loop watching, it raised ${R.defence.falsePositives.alarms} false alarms.`),

  H2('4.7 The interactive app'),
  P('Figures 7 to 12 show the app at 1440 × 900 pixels. Every view was checked by the layout audit (no overlapping, clipped or out-of-window text at 1280 × 720, 1440 × 900, 1536 × 864 and 1920 × 1080) and by the browser check.'),
  shot('pakistan.jpg'), caption('Figure 7. Pakistan from space: the national backbone, the cables leaving Karachi and the land links to China, Afghanistan and Iran.'),
  shot('paksat-close.jpg'), caption('Figure 8. PakSat-MM1 up close (representative model of its DFH-4E platform), with the Earth behind it.'),
  shot('karachi-office-street-life.jpg'), caption('Figure 9. The illustrative Karachi office among OpenStreetMap buildings and streets, on Esri satellite imagery.'),
  shot('aae1-scenario.jpg'), caption('Figure 10. The AAE-1 cable fault of January 2025: the broken cable in red, its fault marked near Qatar, and the scenario card with live measurements.'),
  shot('watch.jpg'), caption('Figure 11. "Watch the story": a chapter of the film, following a real parcel with the route card filling in hop by hop.'),
  shot('marseille-landing-station.jpg'), caption('Figure 12. Where a cable from Karachi lands abroad: the representative landing station at Marseille, on satellite imagery.'),

  H1('5. Limitations'),
  bullet('The internal topology, domestic link capacities, operator market shares and attack volumes are assumptions (Table 2). Results show mechanisms and orders of magnitude, not forecasts.'),
  bullet('A bundle stands for 0.1 Gbit, so behaviour below that granularity (individual TCP flows, congestion control) is not modelled. Routing protocols run on their own compressed clocks, faster than packet time.'),
  bullet('BGP sessions are not mapped onto individual cables: inter-domain convergence after a cable cut is still a timer, and normal international traffic chooses its cable by operator and capacity.'),
  bullet('Detectors see sources as entry points and cities rather than addresses, so the entropy threshold is lower than real deployments would use. Defence runs are seeded and repeatable, but with one seed.'),
  bullet('In the model, YouTube\'s /25s also override PTCL\'s own internal block; in reality the ban inside Pakistan continued.'),
  bullet('The 3D models are representative, not surveyed; the five offices and their server destinations are illustrative; the routes of SEA-ME-WE 6 and 2Africa\'s Pakistan branch, and AAE-1\'s branch into the Gulf, are drawn approximately. Satellites are shown enlarged from far away so they can be seen.'),
  bullet('Street-level photographs need an ArcGIS key; without one the close-up imagery stops at about 10 m per pixel.'),
  bullet('Some facts remain open: whether 2Africa carries traffic for Pakistan, SMW6\'s service status, total international capacity (sources range from 13 to 17.7 Tbps) and the current activity of the PKIX exchanges.'),

  H1('6. Link to the instructor\'s research'),
  P('Ms. Maryam Sajjad\'s published work studies adaptive security and self-protection for mobile computing, and self-adaptation in access-control models. PAKNET applies the same principles at network scale: a monitor–analyse–plan–execute loop over shared knowledge, responses that change with context, and a compromised-phones scenario answered with quarantine and step-up authentication, which is adaptive access control. PAKNET is inspired by that work; it is not an implementation of her framework. Her publication list should be confirmed with her before it is cited.'),

  H1('7. Conclusion'),
  P('Replacing the scripted proof of concept with a simulation changed what the app can say. The single landing city is not just a fact on a slide: losing one cable measurably congests the operator that owns it, and losing all of them leaves a 0.45 Tbps fibre for a country. Count-to-infinity, split horizon\'s limits, OSPF black holes and the 2008 hijack all emerge from the protocol rules rather than from animation, and the adaptive defence can be compared, with numbers, against doing nothing. Drawing it all on a globe, from the cables\' landing points abroad down to an office\'s network room, lets a student follow one message the whole way and see where it can fail.'),

  new Paragraph({ children: [new PageBreak()] }),
  H1('References'),
  P('All web pages accessed 21–27 November 2026. Status, notes and the facts each source supports are in docs/REFERENCES.md.', { run: { size: 18 } }),
  ...sources().map(([id, text]) => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: id + '  ', bold: true, size: 17 }), new TextRun({ text, size: 17 })] }))
];

const doc = new Document({
  creator: 'PAKNET', title: 'PAKNET report', description: 'Computer Networks course project report',
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 30, bold: true, color: '1B2622' }, paragraph: { spacing: { before: 360, after: 140 }, keepNext: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true, color: '2F6F53' }, paragraph: { spacing: { before: 240, after: 100 }, keepNext: true, outlineLevel: 1 } }
    ]
  },
  numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  sections: [{
    properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['PAKNET · page ', PageNumber.CURRENT], size: 16, color: '6B7873' })] })] }) },
    children: body
  }]
});

void TextRun; void ExternalHyperlink; void BorderStyle;
const buf = await Packer.toBuffer(doc);
writeFileSync(join(root, 'docs/PAKNET-report.docx'), buf);
console.log(`wrote docs/PAKNET-report.docx (${Math.round(buf.length / 1024)} KB)`);

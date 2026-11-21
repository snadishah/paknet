// The story library. Each story is a list of beats; a beat may ACT on the
// simulation (enter) and may show LIVE measurements (live). Facts carry their
// source (docs/REFERENCES.md); illustrative parts say so.
//
// beat: { tick, kicker?, title, text, source, view, callouts: [[place, html]], enter(k, fast), live(k) }
import { T2008 } from '../sim/interdomain.js';

const pct = x => Math.round(x * 100) + '%';
const kpis = k => { const m = k.metrics(); return `<div class="live-kpis"><span><b>${m.capTbps.toFixed(1)}</b> Tbps capacity</span><span><b>${m.intlTbps != null ? m.intlTbps.toFixed(1) : '—'}</b> Tbps used</span><span><b class="${(m.lossPct || 0) > 1 ? 'bad' : ''}">${m.lossPct != null ? m.lossPct.toFixed(1) : '—'}%</b> loss</span><span><b>${m.rttMs != null ? m.rttMs.toFixed(0) : '—'}</b> ms RTT</span></div>`; };
const bars = (k, ids) => `<div class="live-bars">${ids.map(id => { const c = k.cable(id), dead = c.edges.every(e => !k.net.usable(e)), u = dead ? 0 : k.util(id); return `<div class="cu"><span>${c.name}</span><div class="bar"><i style="width:${u * 100}%;background:${u > 0.85 ? '#dc2626' : u > 0.65 ? '#d97706' : '#0f766e'}"></i></div><em>${dead ? 'cut' : pct(u)}</em></div>`; }).join('')}</div>`;
const hijackLive = k => { const w = k.interdomain.worldHijackedShare(), p = k.interdomain.pkBlockedShare(); return `<div class="live-kpis"><span><b class="${w > 0 ? 'bad' : ''}">${pct(w)}</b> of the world's YouTube users sent to Pakistan</span><span><b>${pct(p)}</b> of Pakistan's blocked</span><span>BGP clock <b>${k.interdomain.utc()}</b> UTC</span></div>`; };
const beliefs = k => `<div class="live-beliefs">${k.interdomain.beliefs().filter(r => r.kind !== 'pk' || ['PTCL', 'TWA'].includes(r.name)).map(r => `<div><span>${r.name}</span><em>${r.path.slice(1).join(' › ') || 'own route'}</em><b class="${r.end === 'youtube' ? 'ok' : 'bad'}">${r.end === 'youtube' ? 'YouTube' : 'Pakistan'}</b></div>`).join('')}</div>`;
const defenceLine = (k, phase, waiting) => { const e = k.lastDefence(phase); return `<p class="live-note">${e ? e.text : waiting}</p>`; };
const S = { hijack: 'RIPE NCC and Renesys (2008); REFERENCES §1.7', aae1: 'PTA via Dawn, 5 Jan 2025 (S20, S21)', jeddah: 'Kentik, 9 Sep 2025 (S51); Daily Times (S57b)', peace: 'Dawn, 24 Oct 2025, StormFiber statement (S53)', meta: 'Engineering at Meta, 5 Oct 2021 (S54)', cf: 'Cloudflare, 4 Oct 2021 (S55)', pkix: 'PKIX history (S31)', model: 'PAKNET simulation', sajjad: 'REFERENCES §4' };

export const STORIES = [
  {
    id: 'yt2008', title: 'The YouTube hijack', date: '24 February 2008', icon: 'flag', tone: 'red',
    blurb: 'How one route took YouTube offline worldwide',
    setup: k => { k.setDefence(false); k.hijackWorld(); }, // a historical replay: nobody was defending
    beats: [
      { tick: 'Before', title: 'A normal Sunday', view: 'overview', text: 'YouTube (AS36561) announces its address block <code>208.65.152.0/22</code>. Every network in the model reaches it through the large carriers. PTCL (AS17557) is a customer of PCCW and several other carriers.', source: S.hijack, callouts: [['Karachi', 'PTCL · AS17557']], live: k => hijackLive(k) },
      { tick: '18:47', kicker: '18:47:45 UTC', title: 'PTCL blocks YouTube', view: 'karachi', text: 'Ordered to block YouTube in Pakistan, PTCL announces a <b>more specific</b> route, <code>208.65.153.0/24</code>, pointing to nowhere. It meant the route for its own network only, but its export filter was missing, so the announcement also went to its upstreams.', source: S.hijack, callouts: [['Karachi', 'Announces 208.65.153.0/24']], enter: (k, f) => k.bgp(0, 'ptclAnnounce', f), live: k => hijackLive(k) },
      { tick: '18:48', title: 'The leak spreads', view: 'overview', text: 'PTCL\'s other carriers filter the announcement. <b>PCCW (AS3491) does not.</b> To PCCW it is a customer\'s route, which it prefers and passes to its peers. And because a /24 is more specific than YouTube\'s /22, routers everywhere choose it: longest-prefix match. The model\'s routing tables below are live.', source: S.hijack, live: k => hijackLive(k) + beliefs(k) },
      { tick: 'Traffic', title: 'The world\'s YouTube traffic flows into Pakistan', view: 'karachi', text: 'YouTube requests from abroad now arrive on PTCL\'s cables and are dropped in Karachi. The red dots are that traffic, and the loss figure is measured by the simulation.', source: S.model, callouts: [['Karachi', 'YouTube traffic dropped here']], live: k => hijackLive(k) + kpis(k) },
      { tick: '20:07', kicker: '20:07:25 UTC', title: 'YouTube fights back', view: 'overview', text: 'YouTube announces the same <code>/24</code> itself. Carriers that sell to YouTube now prefer their customer\'s route, but <b>PCCW still prefers its own customer, PTCL</b>, so the networks behind PCCW stay hijacked: a partial recovery, as seen that evening.', source: S.hijack, enter: (k, f) => k.bgp(T2008.ytSame24, 'ytSame24', f), live: k => hijackLive(k) + beliefs(k) },
      { tick: '20:18', kicker: '20:18:43 UTC', title: 'Two /25s win everywhere', view: 'overview', text: 'YouTube announces <code>208.65.153.0/25</code> and <code>208.65.153.128/25</code>. They are more specific than PTCL\'s /24, so longest-prefix match sends traffic back to YouTube. (In the model this also overrides PTCL\'s own block; in reality the ban inside Pakistan continued.)', source: S.hijack, enter: (k, f) => k.bgp(T2008.yt25s, 'yt25s', f), live: k => hijackLive(k) + beliefs(k) },
      { tick: '20:59', kicker: '20:59:39 UTC', title: 'PCCW filters PTCL', view: 'overview', text: 'PCCW stops accepting the bad route from PTCL, and it disappears from the internet. The worldwide outage lasted about two hours.', source: S.hijack, enter: (k, f) => k.bgp(T2008.pccwFilter, 'pccwFilter', f), live: k => hijackLive(k) },
      { tick: 'Lessons', title: 'What would have stopped it', view: 'overview', text: '<b>An export filter at PTCL</b> (the route was meant to stay inside), <b>a customer prefix filter at PCCW</b> (PTCL was not registered for YouTube\'s addresses), and today <b>route origin validation</b>: YouTube\'s prefix now has RPKI records, so a /24 from PTCL would be rejected as Invalid.', source: 'REFERENCES §0 #10, §3', live: () => '<button class="btn" data-story-action="replayRov">Replay with today\'s rules (adaptive defence on)</button>' }
    ]
  },
  {
    id: 'aae1', title: 'AAE-1 goes dark', date: '2 January 2025', icon: 'cable', tone: 'amber',
    blurb: 'PTCL\'s biggest cable fails near Qatar',
    beats: [
      { tick: 'Before', title: 'PTCL\'s biggest cable', view: 'karachi', text: 'AAE-1 lands at Clifton beach. In PTA\'s figures it carried <b>3.58 Tbps</b> of active capacity, more than any other cable, out of 4.77 Tbps installed.', source: 'PTA via TechJuice (S18); REFERENCES §1.1', callouts: [['PTCL landing station · Clifton / Sea View', 'AAE-1 lands here']], live: k => kpis(k) + bars(k, ['AAE1', 'IMEWE', 'SMW4']) },
      { tick: '2 Jan', kicker: 'Thursday 2 January 2025', title: 'A fault near Qatar', view: 'sea', text: 'AAE-1 fails near Qatar. Pakistan loses at least 1 Tbps; complaints spike between 20:00 and 23:00 PKT. In the model the cable is cut and the traffic it carried looks for other paths.', source: S.aae1, enter: k => k.cut(['AAE1']), live: k => kpis(k) + bars(k, ['AAE1', 'IMEWE', 'SMW4']) },
      { tick: 'Shift', title: 'Traffic moves to IMEWE and SMW4', view: 'karachi', text: 'PTCL moves about <b>1.8 Tbps to IMEWE</b> and <b>1.5 Tbps to SMW4</b>. Both were already nearly full, so spare capacity had to be switched on. In the model they go from their active to their installed capacity (1.9 → 2.76 and 1.98 → 2.58 Tbps).', source: S.aae1 + '; PTA (S18)', enter: k => { k.setCableCapacity('IMEWE', 2760); k.setCableCapacity('SMW4', 2580); }, live: k => kpis(k) + bars(k, ['AAE1', 'IMEWE', 'SMW4']) },
      { tick: '4 Jan', kicker: '4 January 2025', title: 'Most of it recovered', view: 'karachi', text: 'By 4 January about <b>80%</b> of the shortfall was recovered. Repairs at sea take much longer: a 2021 AAE-1 fault in Pakistani waters took about 45 days to fix.', source: S.aae1, live: k => kpis(k) },
      { tick: 'Lessons', title: 'One coast, one point of failure', view: 'overview', text: 'Every international cable lands in Karachi. More cables help, but they share one coastline and often one route through the Red Sea. A second landing, like the planned Gwadar station, adds diversity.', source: 'REFERENCES §1.1, §1.2', live: () => '<button class="btn ghost" data-story-action="gwadar">Try the Gwadar what-if</button>' }
    ]
  },
  {
    id: 'redsea', title: 'Red Sea cuts', date: 'September–October 2025', icon: 'cable', tone: 'amber',
    blurb: 'Two cuts, five weeks apart',
    beats: [
      { tick: 'Before', title: 'Many cables, one sea', view: 'sea', text: 'Most of Pakistan\'s cables to Europe pass through the Red Sea before reaching Egypt.', source: 'REFERENCES §5', live: k => kpis(k) + bars(k, ['SMW4', 'IMEWE', 'SMW5', 'AAE1', 'PEACE']) },
      { tick: '5 Sep', kicker: '5–6 September 2025, from ~22:30 UTC', title: 'SMW4 and IMEWE cut near Jeddah', view: 'sea', text: 'Two of PTCL\'s cables are cut near Jeddah, along with EIG and FALCON (which don\'t land in Pakistan). <b>SMW5, AAE-1 and PEACE keep running.</b> The cause was not confirmed.', source: S.jeddah, enter: k => k.cut(['SMW4', 'IMEWE']), live: k => kpis(k) + bars(k, ['SMW4', 'IMEWE', 'SMW5', 'AAE1', 'PEACE']) },
      { tick: 'Sep', title: 'Alternate routes', view: 'karachi', text: 'PTCL confirmed reduced capacity and arranged alternate routes. Watch the remaining cables take the load.', source: S.jeddah, live: k => kpis(k) + bars(k, ['SMW5', 'AAE1', 'PEACE', 'TW1', 'SMW6']) },
      { tick: '20 Oct', kicker: '20 October 2025, ~17:30 PKT', title: 'PEACE cut near Sudan', view: 'sea', text: 'Five weeks later, PEACE, the cable Cybernet (StormFiber) relies on, is cut in the Red Sea near Sudan. (In the model SMW4 and IMEWE are back by now; their exact repair dates are not in our sources.)', source: S.peace, enter: k => { k.restore(['SMW4', 'IMEWE']); k.cut(['PEACE']); }, live: k => kpis(k) + bars(k, ['PEACE', 'SMW4', 'IMEWE', 'SMW5', 'AAE1']) },
      { tick: 'Oct', title: 'Recovery', view: 'karachi', text: 'StormFiber restored over 60% of the lost capacity quickly, using other cables and new capacity through the UAE, Oman and Hong Kong, and promised full recovery by 27 October.', source: S.peace, live: k => kpis(k) },
      { tick: 'Lessons', title: 'Diversity beats numbers', view: 'overview', text: 'Pakistan has around nine cables, but they share a landing city and, for Europe, a narrow sea. Real resilience needs physically different routes.', source: 'REFERENCES §5', live: k => kpis(k) }
    ]
  },
  {
    id: 'ddos', title: 'A flood, answered', date: 'Illustrative', icon: 'wave', tone: 'red',
    blurb: 'The adaptive defence against a DDoS',
    setup: k => k.setDefence(false),
    beats: [
      { tick: 'Target', title: 'A CDN edge in Lahore', viewFocus: ['Lahore', 0.8], text: 'Content caches like this one serve videos and pages from inside Pakistan. This story is illustrative: the attack is made up, the network\'s response is simulated.', source: S.model, callouts: [['Cloudflare edge · Lahore', 'The target']], live: k => kpis(k) },
      { tick: 'Flood', title: 'The flood, with nobody watching', viewFocus: ['Lahore', 1.2], text: '8 Tbps arrives on the cables, plus a botnet inside Pakistan. The data centre\'s uplink saturates, queues at Lahore overflow, and ordinary users\' traffic is lost. Defence is off.', source: S.model, enter: k => { k.setDefence(false); k.security.runDDoS(); }, live: k => kpis(k) },
      { tick: 'Watch', kicker: 'Monitor', title: 'Now with the defence on', viewFocus: ['Lahore', 1.2], text: 'Same attack, but the MAPE-K loop is running. It watches flow telemetry: how much traffic each protected destination receives, and from how many different sources.', source: 'Kephart and Chess (2003); REFERENCES §3', enter: k => { k.security.stop(); k.setDefence(true); k.security.runDDoS(); }, live: k => kpis(k) + defenceLine(k, 'analyse', 'Monitoring…') },
      { tick: 'Analyse', kicker: 'Analyse and plan', title: 'Volume and sources both look wrong', viewFocus: ['Lahore', 1.2], text: 'Two detectors agree: the volume is far above its learned normal (an EWMA z-score), and the traffic suddenly comes from many sources at once (entropy rises, as in Lakhina et al.).', source: 'REFERENCES §3, §7', live: k => defenceLine(k, 'analyse', 'Waiting for the detectors…') + defenceLine(k, 'plan', '') },
      { tick: 'Execute', title: 'Diverted to scrubbing', view: 'karachi', text: 'Traffic for the Lahore edge is sent to the scrubbing centre in Karachi, which keeps only clean traffic. Loss falls back.', source: S.model, callouts: [['TWA Tier III data centre', 'Scrubbing centre']], live: k => defenceLine(k, 'execute', 'Waiting…') + kpis(k) },
      { tick: 'Compare', title: 'Before and after', view: 'overview', text: 'The two runs are compared in the Security tab once this attack ends (about 15 seconds of screen time): detection time, response time, and loss with and without the defence.', source: S.model, live: k => kpis(k) }
    ]
  },
  {
    id: 'phones', title: 'Phones that call home', date: 'Illustrative', icon: 'phone', tone: 'red',
    blurb: 'Self-protection and adaptive access control',
    setup: k => k.setDefence(true),
    beats: [
      { tick: 'Phones', title: 'Compromised phones near Mardan', viewFocus: ['Mardan', 0.8], text: 'Malware on phones near Mardan waits for orders from a command server abroad. Illustrative: the infection is made up, the detection and response are simulated.', source: S.model, callouts: [['Mardan', 'Infected devices']], live: k => kpis(k) },
      { tick: 'Beacons', title: 'A machine-like rhythm', viewFocus: ['Mardan', 1.4], text: 'Each phone "beacons": it contacts the same server at a fixed interval. People don\'t browse like that; their connections arrive at random.', source: S.model, enter: k => { k.setDefence(true); k.security.runMalware(); }, live: k => defenceLine(k, 'analyse', 'The loop is watching the connections…') },
      { tick: 'Analyse', kicker: 'Analyse', title: 'The gaps are too regular', viewFocus: ['Mardan', 1.4], text: 'The loop measures the gaps between connections. For random traffic their variation is about 100%; for these phones it is a few percent.', source: 'REFERENCES §7', live: k => defenceLine(k, 'analyse', 'Waiting for enough connections…') },
      { tick: 'Respond', kicker: 'Plan and execute', title: 'Quarantine and step-up authentication', viewFocus: ['Mardan', 1.4], text: 'The devices are quarantined, users must re-authenticate before regaining access, and the server is blocked at the edge: <b>access control that adapts</b> to what the network sees.', source: S.model, live: k => defenceLine(k, 'execute', 'Waiting…') },
      { tick: 'Research', title: 'The same idea, at network scale', view: 'overview', text: 'Ms. Maryam Sajjad\'s work studies adaptive security and self-protection for mobile devices, and self-adapting access control. PAKNET applies the same principles to a national network: monitor, analyse, plan, execute, with knowledge that keeps learning. It is <i>inspired by</i> that work, not an implementation of it.', source: S.sajjad }
    ]
  },
  {
    id: 'fb2021', title: 'Facebook disappears', date: '4 October 2021', icon: 'globe', tone: 'amber',
    blurb: 'When the routes to DNS vanish, caches can\'t help',
    setup: k => { k.setDefence(false); k.fbWorld(); },
    beats: [
      { tick: 'Before', title: 'A cache in Lahore', viewFocus: ['Lahore', 0.8], text: 'Facebook placed a cache at the Lahore internet exchange, so Pakistani users get much of its content locally. The teal dots are that traffic. (The Pakistani part of this story is illustrative.)', source: S.pkix, callouts: [['PKIX Lahore', 'Facebook cache']], live: k => `<div class="live-kpis"><span><b>${pct(k.interdomain.fbReachableShare())}</b> of Pakistani users can reach Facebook's DNS</span></div>` },
      { tick: '15:39', kicker: '15:39 UTC', title: 'A routine command goes wrong', view: 'overview', text: 'During maintenance, a command meant to assess backbone capacity takes down all of Facebook\'s backbone links. An audit tool that should have stopped it had a bug.', source: S.meta },
      { tick: '15:40', kicker: '15:40–15:58 UTC', title: 'DNS servers withdraw their routes', view: 'overview', text: 'Facebook\'s DNS servers, cut off from the data centres, stop announcing their own prefixes, <code>185.89.218.0/23</code> and <code>129.134.30.0/23</code>. In the model the withdrawal travels through BGP until no network has a route.', source: S.cf + '; ' + S.meta, enter: (k, f) => k.bgp(60000, 'fbWithdraw', f), live: k => `<div class="live-kpis"><span><b class="bad">${pct(k.interdomain.fbReachableShare())}</b> of Pakistani users can reach Facebook's DNS</span><span>BGP clock <b>${k.interdomain.utc()}</b> UTC</span></div>` },
      { tick: 'Pakistan', title: 'The cache is up, but nobody can find it', viewFocus: ['Lahore', 1.4], text: 'The Lahore cache still works, but phones can no longer look up Facebook\'s names, so nobody reaches it. Their lookups fail and retry (the grey dots): resolvers saw about <b>30×</b> the normal number of queries.', source: S.cf, live: k => kpis(k) },
      { tick: '21:00', kicker: '~21:00 UTC', title: 'Routes return', view: 'overview', text: 'Engineers restore the backbone; BGP routes return around 21:00 and DNS works again by about 21:20 UTC. Close to six hours.', source: S.cf, enter: (k, f) => k.bgp(5 * 3600000 + 21 * 60000, 'fbReturn', f), live: k => `<div class="live-kpis"><span><b>${pct(k.interdomain.fbReachableShare())}</b> of Pakistani users can reach Facebook's DNS</span></div>` },
      { tick: 'Lessons', title: 'The control plane is part of the service', view: 'overview', text: 'Local caches make the internet faster, but they depend on DNS and BGP working. When the routes to the name servers vanish, the content might as well not exist.', source: S.meta + '; ' + S.cf }
    ]
  }
];

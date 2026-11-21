// Inter-domain routing for the simulation: a BGP world (routing/bgp.js) set up
// as on 24 February 2008, the scenario timeline, and the data-plane questions
// traffic needs answered ("where does this network send YouTube traffic?").
// Emits events; never touches rendering or the DOM.
//
// Nothing about the leak is scripted: the timeline only performs the OPERATOR
// ACTIONS that happened (REFERENCES §1.7); where routes go follows from BGP.
import { emit } from '../events.js';
import { createBGP } from '../routing/bgp.js';
import { ASES, AS_LINKS, REGISTERED, ROAS, YT_PREFIX, HIJACK_PREFIX, YT_25S, YT_ADDR } from '../routing/as-topology.js';
import { BGP, BGP_MS_PER_S, BGP_FAST_MS_PER_S, PK_USER_SHARE } from './params.js';

export const AS_BY_ASN = new Map(ASES.map(a => [a.asn, a]));
const WORLD = ASES.filter(a => a.kind === 'world');
const CARRIERS = [3491, 3356, 1299, 174];
const MIN = 60000;
// the real timeline, as offsets from 18:47:45 UTC (REFERENCES §1.7)
export const T2008 = { start: '18:47:45', ytSame24: 79 * MIN + 40000, yt25s: 90 * MIN + 58000, pccwFilter: 131 * MIN + 54000 };

export function createInterdomain() {
  let bgp, t0 = 0, scenario = null;

  function build() {
    bgp = createBGP({ ases: ASES, links: AS_LINKS, registered: REGISTERED, roas: ROAS, params: { mraiMs: BGP.mraiMs, delayMs: () => BGP.sessionDelayMs } });
    // in 2008 PTCL's other upstreams filtered its announcements; PCCW did not
    for (const asn of [3356, 1299, 174]) bgp.AS.get(asn).policy.customerFilter = true;
    bgp.originate(36561, YT_PREFIX);
    while (bgp.busy) bgp.advance(bgp.now + 1000);
    bgp.hooks.best = (asn, prefix, best) => emit('bgp:best', { asn, prefix, best });
    bgp.hooks.converged = r => emit('bgp:converged', r);
    scenario = null;
  }
  build();

  /* ---------- the 2008 hijack ---------- */
  // opts.rov: what-if, carriers run route origin validation (today's RPKI rules)
  function startHijack({ rov = false } = {}) {
    build();
    scenario = { rov, phase: 'leak' };
    if (rov) for (const c of CARRIERS) bgp.setPolicy(c, { rov: true });
    t0 = bgp.now;
    const act = (dt, label, fn, phase) => bgp.schedule(t0 + dt, () => { fn(); if (phase) scenario.phase = phase; emit('bgp:action', { label, utc: utc() }); });
    act(0, 'PTCL (AS17557) announces <code>208.65.153.0/24</code> to block YouTube inside Pakistan. Its export filter is missing, so the route goes to its upstreams too.', () => bgp.originate(17557, HIJACK_PREFIX, { exportTo: 'all' }));
    act(T2008.ytSame24, 'YouTube announces the same <code>/24</code> itself, to compete.', () => bgp.originate(36561, HIJACK_PREFIX), 'yt24');
    act(T2008.yt25s, 'YouTube announces two <code>/25</code>s: more specific than PTCL\'s /24.', () => YT_25S.forEach(p => bgp.originate(36561, p)), 'yt25');
    act(T2008.pccwFilter, 'PCCW (AS3491) filters PTCL\'s announcement. The hijack ends.', () => bgp.setPolicy(3491, { customerFilter: true }), 'over');
  }
  function stop() { build(); }

  // Scenario clock as UTC on the day, e.g. "18:49:12".
  function utc() {
    const [h, m, s] = T2008.start.split(':').map(Number);
    const secs = h * 3600 + m * 60 + s + Math.floor((bgp.now - t0) / 1000);
    return [Math.floor(secs / 3600) % 24, Math.floor(secs / 60) % 60, secs % 60].map(x => String(x).padStart(2, '0')).join(':');
  }

  /* ---------- clock ---------- */
  function advance(sdt) {
    if (!scenario || sdt <= 0) return;
    const fast = !bgp.routing && bgp.nextEventIn() !== Infinity;
    bgp.advance(bgp.now + sdt * (fast ? BGP_FAST_MS_PER_S : BGP_MS_PER_S));
    emit('bgp:tick', { utc: utc(), fast, phase: scenario.phase });
  }

  /* ---------- data plane ---------- */
  // Follow longest-prefix-match next hops AS by AS. Returns the ASes visited and
  // where the traffic ends: 'youtube', 'ptcl' (black-holed by PTCL's null route) or 'lost'.
  function dataPath(asn, ip = YT_ADDR) {
    const seen = [asn]; let cur = asn;
    for (let i = 0; i < 12; i++) {
      const r = bgp.lookup(cur, ip); if (!r) return { ases: seen, end: 'lost' };
      if (r.rel === 'self') return { ases: seen, end: cur === 36561 ? 'youtube' : cur === 17557 ? 'ptcl' : 'lost' };
      cur = r.path[1]; if (seen.includes(cur)) return { ases: seen, end: 'lost' }; seen.push(cur);
    }
    return { ases: seen, end: 'lost' };
  }
  // Share of the world's YouTube users whose traffic ends at PTCL.
  const worldHijackedShare = () => WORLD.reduce((s, a) => s + (dataPath(a.asn).end === 'ptcl' ? a.share : 0), 0);
  // Share of Pakistani users whose YouTube traffic is black-holed.
  const pkBlockedShare = () => Object.entries(PK_USER_SHARE).reduce((s, [asn, w]) => s + (dataPath(+asn).end !== 'youtube' ? w : 0), 0);

  // What each network believes about YouTube's address right now (for the UI).
  function beliefs() {
    return ASES.filter(a => a.asn !== 36561).map(a => {
      const r = bgp.lookup(a.asn, YT_ADDR), d = dataPath(a.asn);
      return { asn: a.asn, name: a.name, kind: a.kind, prefix: r?.prefix, path: r?.path || [], end: d.end };
    });
  }

  return {
    get bgp() { return bgp; }, get active() { return !!scenario; }, get phase() { return scenario?.phase; },
    startHijack, stop, advance, utc, dataPath, worldHijackedShare, pkBlockedShare, beliefs
  };
}

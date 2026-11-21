// Simplified BGP: does the 2008 YouTube hijack emerge from the rules?
import { describe, it, expect } from 'vitest';
import { createBGP } from '../src/routing/bgp.js';
import { ASES, AS_LINKS, REGISTERED, ROAS, YT_PREFIX, HIJACK_PREFIX, YT_25S, YT_ADDR } from '../src/routing/as-topology.js';

const WORLD = ASES.filter(a => a.kind === 'world').map(a => a.asn);
const CARRIERS = [3491, 3356, 1299, 174];

function world2008({ pccwFilters = false } = {}) {
  const bgp = createBGP({ ases: ASES, links: AS_LINKS, registered: REGISTERED, roas: ROAS, params: { mraiMs: 30000, delayMs: () => 500 } });
  // in 2008 PTCL's other upstreams filtered its announcements; PCCW did not (REFERENCES §1.7)
  for (const asn of [3356, 1299, 174]) bgp.AS.get(asn).policy.customerFilter = true;
  bgp.AS.get(3491).policy.customerFilter = pccwFilters;
  bgp.originate(36561, YT_PREFIX);
  run(bgp);
  return bgp;
}
function run(bgp) { let t = bgp.now; while (bgp.busy) { t += 1000; bgp.advance(t); } }
const originOf = (bgp, asn) => { const r = bgp.lookup(asn, YT_ADDR); return r && r.path[r.path.length - 1]; };
const hijacked = bgp => WORLD.filter(asn => originOf(bgp, asn) === 17557);

// Valley-free check: a path (from the observer outwards) goes up, at most one peer step, then down.
function valleyFree(bgp, path) {
  let phase = 0; // 0 up, 1 after the peer step / going down
  for (let i = 0; i < path.length - 1; i++) {
    const rel = bgp.AS.get(path[i]).nbrs.get(path[i + 1]); // how path[i] sees the next AS
    if (rel === 'provider') { if (phase > 0) return false; } else if (rel === 'peer') { if (phase > 0) return false; phase = 1; } else phase = 1;
  }
  return true;
}

describe('BGP: normal day', () => {
  it('everyone reaches YouTube over valley-free paths', () => {
    const bgp = world2008();
    for (const a of ASES) {
      if (a.asn === 36561) continue;
      const r = bgp.lookup(a.asn, YT_ADDR);
      expect(r, a.name).not.toBeNull();
      expect(r.prefix).toBe(YT_PREFIX);
      expect(valleyFree(bgp, r.path)).toBe(true);
    }
  });
});

describe('BGP: 24 February 2008', () => {
  it('with PTCL\'s export filter in place, the /24 stays inside PTCL', () => {
    const bgp = world2008();
    bgp.originate(17557, HIJACK_PREFIX, { exportTo: 'none' }); run(bgp);
    expect(hijacked(bgp)).toEqual([]);
    expect(originOf(bgp, 17557)).toBe(17557); // PTCL itself black-holes YouTube, as intended
  });

  it('without it, the /24 leaks through PCCW and the world sends YouTube traffic to Pakistan', () => {
    const bgp = world2008();
    bgp.originate(17557, HIJACK_PREFIX, { exportTo: 'all' }); run(bgp);
    expect(hijacked(bgp).sort()).toEqual([...WORLD].sort()); // longest-prefix match: /24 beats /22
    for (const c of [3356, 1299, 174]) expect(bgp.lookup(c, YT_ADDR).path.slice(1)).toEqual([3491, 17557]); // learnt from peer PCCW
    expect(bgp.lookup(3491, YT_ADDR).path).toEqual([3491, 17557]); // "3491 17557", the first path seen
  });

  it('PTCL\'s other upstreams filtered it: only the PCCW path exists', () => {
    const bgp = world2008();
    bgp.originate(17557, HIJACK_PREFIX); run(bgp);
    for (const c of [3356, 1299, 174]) expect(bgp.AS.get(c).ribIn.get(HIJACK_PREFIX).has(17557)).toBe(false);
  });

  it('even TWA and its customers follow the leak (via their carriers)', () => {
    const bgp = world2008();
    bgp.originate(17557, HIJACK_PREFIX); run(bgp);
    expect(originOf(bgp, 38193)).toBe(17557);
    expect(originOf(bgp, 18053)).toBe(17557);
  });

  it('a customer prefix filter at PCCW would have stopped it there', () => {
    const bgp = world2008({ pccwFilters: true });
    bgp.originate(17557, HIJACK_PREFIX); run(bgp);
    expect(hijacked(bgp)).toEqual([]);
  });

  it('YouTube\'s /24 wins back part of the world; its /25s win everything', () => {
    const bgp = world2008();
    bgp.originate(17557, HIJACK_PREFIX); run(bgp);
    bgp.originate(36561, HIJACK_PREFIX); run(bgp); // 20:07: same /24, competing on policy and path length
    const after24 = hijacked(bgp).length;
    expect(after24).toBeLessThan(WORLD.length);
    for (const p of YT_25S) bgp.originate(36561, p); run(bgp); // 20:18: more specific
    expect(hijacked(bgp)).toEqual([]);
  });

  it('PCCW applying a filter at 20:59 ends it', () => {
    const bgp = world2008();
    bgp.originate(17557, HIJACK_PREFIX); run(bgp);
    bgp.setPolicy(3491, { customerFilter: true }); run(bgp);
    expect(hijacked(bgp)).toEqual([]);
    for (const c of CARRIERS) expect(bgp.AS.get(c).best.has(HIJACK_PREFIX)).toBe(false);
  });

  it('what-if: route origin validation at the carriers rejects the /24 as Invalid', () => {
    const bgp = world2008();
    expect(bgp.rov(HIJACK_PREFIX, 17557)).toBe('invalid');
    expect(bgp.rov(YT_PREFIX, 36561)).toBe('valid');
    for (const c of CARRIERS) bgp.setPolicy(c, { rov: true });
    bgp.originate(17557, HIJACK_PREFIX); run(bgp);
    expect(hijacked(bgp)).toEqual([]);
  });

  it('the leak takes MRAI-limited time to spread, and it can be measured', () => {
    const bgp = world2008(); let conv = null; bgp.hooks.converged = r => (conv = r);
    const first = new Map(); bgp.hooks.best = (asn, prefix) => { if (prefix === HIJACK_PREFIX && !first.has(asn)) first.set(asn, bgp.now); };
    const t0 = bgp.now; bgp.originate(17557, HIJACK_PREFIX); run(bgp);
    expect(first.get(64603) - t0).toBeGreaterThan(first.get(3491) - t0); // reaches PCCW before Asia's ISPs
    expect(conv.ms).toBeGreaterThan(0);
    expect(conv.updates).toBeGreaterThan(5);
  });
});

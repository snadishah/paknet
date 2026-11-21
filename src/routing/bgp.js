// Simplified BGP between autonomous systems. Pure: no three.js, no DOM.
//
// RFC 4271 decision process, reduced to what matters here, plus the
// Gao–Rexford policy model (REFERENCES §3):
//   1. LOCAL_PREF by relationship: own route > customer > peer > provider
//   2. shortest AS_PATH
//   3. lowest neighbour ASN (stands in for the router-ID tie-break)
// Export (valley-free): routes from yourself or a customer go to everyone;
// routes from a peer or provider go only to customers. A route is never sent
// back to the AS it came from, and an AS rejects paths that already contain it.
//
// Optional per-AS filters (the levers of the 2008 story):
//   - an origin's EXPORT FILTER: a route marked internal is not announced at all
//   - a provider's CUSTOMER PREFIX FILTER: accept from a customer only what it
//     is registered to announce
//   - ROUTE ORIGIN VALIDATION (RPKI, RFC 6811): drop routes whose origin is Invalid
// Forwarding uses longest-prefix match over each AS's best routes.
// UPDATEs travel with a per-session delay; repeated advertisements to the same
// neighbour are rate-limited by MRAI (30 s × jitter); withdrawals are sent at
// once (a simplification).
import { Heap } from './dijkstra.js';

const LP = { self: 400, customer: 300, peer: 200, provider: 100 };

/* ---------- prefixes ---------- */
export function parsePrefix(p) {
  const [ip, len] = p.split('/'); const n = ip.split('.').reduce((a, o) => a * 256 + +o, 0);
  return { net: n, len: +len };
}
const ipNum = ip => ip.split('.').reduce((a, o) => a * 256 + +o, 0);
const covers = (pfx, ip) => { const { net, len } = parsePrefix(pfx); const size = 2 ** (32 - len); return ip >= net && ip < net + size; };

/**
 * @param {object} o
 * @param {{asn:number}[]} o.ases
 * @param {{a:number,b:number,rel:'p2c'|'p2p'}[]} o.links
 * @param {object} o.registered   asn → prefixes it may announce (for customer filters)
 * @param {{prefix:string,maxLength:number,asn:number}[]} o.roas
 * @param {object} o.params       { mraiMs, delayMs(a,b) }
 */
export function createBGP({ ases, links, registered = {}, roas = [], params }) {
  const P = { mraiMs: 30000, jitter: [0.75, 1], delayMs: () => 200, ...params };
  const AS = new Map(ases.map(a => [a.asn, {
    ...a, nbrs: new Map(),          // neighbour asn → relationship from MY side: 'customer' | 'peer' | 'provider'
    ribIn: new Map(),               // prefix → Map(neighbour → path)
    best: new Map(),                // prefix → { path, from, rel }
    own: new Map(),                 // prefix → { exportTo: 'all' | 'none' }
    policy: { customerFilter: false, rov: false }
  }]));
  for (const { a, b, rel } of links) {
    if (rel === 'p2c') { AS.get(a).nbrs.set(b, 'customer'); AS.get(b).nbrs.set(a, 'provider'); }
    else { AS.get(a).nbrs.set(b, 'peer'); AS.get(b).nbrs.set(a, 'peer'); }
  }
  const hooks = { best: null, update: null };

  /* ---------- validation and policy ---------- */
  function rov(prefix, origin) { // RFC 6811: Valid / Invalid / NotFound
    const { net, len } = parsePrefix(prefix); let covered = false;
    for (const r of roas) {
      const R = parsePrefix(r.prefix);
      if (len >= R.len && covers(r.prefix, net)) { covered = true; if (r.asn === origin && len <= r.maxLength) return 'valid'; }
    }
    return covered ? 'invalid' : 'notfound';
  }
  function acceptable(me, from, prefix, path) {
    if (path.includes(me.asn)) return false; // loop
    if (me.policy.customerFilter && me.nbrs.get(from) === 'customer' && !(registered[from] || []).includes(prefix)) {
      // a customer may also pass on its own customers' registered prefixes
      const origin = path[path.length - 1];
      if (!(registered[origin] || []).includes(prefix) || AS.get(from).nbrs.get(origin) !== 'customer') return false;
    }
    if (me.policy.rov && rov(prefix, path[path.length - 1]) === 'invalid') return false;
    return true;
  }

  /* ---------- decision ---------- */
  function decide(me, prefix) {
    let best = null;
    if (me.own.has(prefix)) best = { path: [me.asn], from: me.asn, rel: 'self' };
    else for (const [from, path] of me.ribIn.get(prefix) || []) {
      const rel = me.nbrs.get(from), cand = { path: [me.asn, ...path], from, rel };
      if (!best || better(cand, best)) best = cand;
    }
    const old = me.best.get(prefix);
    const same = old && best && old.from === best.from && old.path.join() === best.path.join();
    if (same || (!old && !best)) return;
    if (best) me.best.set(prefix, best); else me.best.delete(prefix);
    hooks.best?.(me.asn, prefix, best);
    advertise(me, prefix);
  }
  const better = (x, y) => LP[x.rel] !== LP[y.rel] ? LP[x.rel] > LP[y.rel] : x.path.length !== y.path.length ? x.path.length < y.path.length : x.from < y.from;

  // What I tell neighbour n about prefix (null = withdraw), by valley-free export.
  function exportTo(me, n, prefix) {
    const b = me.best.get(prefix); if (!b) return null;
    if (b.rel === 'self' && me.own.get(prefix).exportTo === 'none') return null; // export filter
    if (b.from === n) return null;
    const toCustomer = me.nbrs.get(n) === 'customer';
    if (!(b.rel === 'self' || b.rel === 'customer' || toCustomer)) return null;
    return b.path;
  }

  /* ---------- sessions and timing ---------- */
  let now = 0, rng = 1;
  const rand = () => (rng = (rng * 16807) % 2147483647) / 2147483647; // deterministic jitter
  const events = new Heap(), at = (t, ev) => events.push([t, ev]);
  const sent = new Map();      // `${a}>${b}|${prefix}` → last path sent (string) or '' for withdrawn
  const mraiUntil = new Map(); // `${a}>${b}` → time the next advertisement may go
  const flushPending = new Set();
  let watch = null;

  function advertise(me, prefix) {
    for (const n of me.nbrs.keys()) {
      const path = exportTo(me, n, prefix), key = `${me.asn}>${n}|${prefix}`, prev = sent.get(key) ?? '';
      const val = path ? path.join(' ') : '';
      if (val === prev) continue;
      const sess = `${me.asn}>${n}`;
      if (!path) { sent.set(key, ''); send(me.asn, n, prefix, null); continue; } // withdrawals go at once
      if (now >= (mraiUntil.get(sess) ?? -Infinity)) {
        sent.set(key, val); send(me.asn, n, prefix, path);
        mraiUntil.set(sess, now + P.mraiMs * (P.jitter[0] + (P.jitter[1] - P.jitter[0]) * rand()));
      } else if (!flushPending.has(sess)) { flushPending.add(sess); at(mraiUntil.get(sess), { type: 'flush', a: me.asn, b: n }); }
    }
  }
  function send(a, b, prefix, path) {
    if (watch) watch.updates++;
    hooks.update?.(a, b, prefix, path);
    at(now + P.delayMs(a, b), { type: 'update', from: a, to: b, prefix, path });
  }
  function flush(a, b) {
    flushPending.delete(`${a}>${b}`); mraiUntil.delete(`${a}>${b}`);
    const me = AS.get(a); const prefixes = new Set([...me.best.keys(), ...[...sent.keys()].filter(k => k.startsWith(`${a}>${b}|`)).map(k => k.split('|')[1])]);
    for (const prefix of prefixes) {
      const path = exportTo(me, b, prefix), key = `${a}>${b}|${prefix}`, val = path ? path.join(' ') : '';
      if (val !== (sent.get(key) ?? '')) { sent.set(key, val); send(a, b, prefix, path); }
    }
    mraiUntil.set(`${a}>${b}`, now + P.mraiMs * (P.jitter[0] + (P.jitter[1] - P.jitter[0]) * rand()));
  }
  function receive({ from, to, prefix, path }) {
    const me = AS.get(to); if (!me.ribIn.has(prefix)) me.ribIn.set(prefix, new Map());
    const rib = me.ribIn.get(prefix);
    if (path && acceptable(me, from, prefix, path)) rib.set(from, path); else rib.delete(from);
    decide(me, prefix);
  }

  /* ---------- the outside world's levers ---------- */
  function startWatch() { if (!watch) watch = { t0: now, updates: 0, lastChange: now }; }
  function originate(asn, prefix, { exportTo: ex = 'all' } = {}) { startWatch(); const me = AS.get(asn); me.own.set(prefix, { exportTo: ex }); decide(me, prefix); advertise(me, prefix); }
  function withdrawOwn(asn, prefix) { startWatch(); const me = AS.get(asn); me.own.delete(prefix); decide(me, prefix); advertise(me, prefix); }
  // Change an AS's import policy and re-evaluate what it has received.
  function setPolicy(asn, pol) {
    startWatch(); const me = AS.get(asn); Object.assign(me.policy, pol);
    for (const [prefix, rib] of me.ribIn) for (const [from, path] of rib) if (!acceptable(me, from, prefix, path)) rib.delete(from);
    // routes dropped earlier by a filter come back on the neighbours' next advertisement: ask them
    for (const n of me.nbrs.keys()) { for (const k of [...sent.keys()]) if (k.startsWith(`${n}>${asn}|`)) sent.delete(k); for (const prefix of AS.get(n).best.keys()) advertise(AS.get(n), prefix); }
    for (const prefix of me.ribIn.keys()) decide(me, prefix);
  }
  function setOriginExport(asn, prefix, ex) { const me = AS.get(asn); if (!me.own.has(prefix)) return; startWatch(); me.own.get(prefix).exportTo = ex; advertise(me, prefix); }

  function advance(t) {
    while (events.size && events.a[0][0] <= t) {
      const [et, ev] = events.pop(); now = et;
      if (ev.type === 'update') receive(ev); else if (ev.type === 'flush') flush(ev.a, ev.b); else if (ev.type === 'action') { ev.fn(); continue; }
      if (watch) watch.lastChange = now;
    }
    if (t > now) now = t;
    if (watch && !events.a.some(e => e[1].type !== 'action')) { const w = watch; watch = null; hooks.converged?.({ ms: w.lastChange - w.t0, updates: w.updates }); }
  }
  // Run fn at BGP time t (an operator action in a scenario timeline).
  const schedule = (t, fn) => at(t, { type: 'action', fn });
  // Is anything other than scheduled actions still in flight?
  const routing = () => events.a.some(e => e[1].type !== 'action');

  /* ---------- forwarding ---------- */
  // Longest-prefix match over an AS's best routes.
  function lookup(asn, ip) {
    const me = AS.get(asn), x = ipNum(ip); let best = null, bestLen = -1;
    for (const [prefix, r] of me.best) {
      if (!/^\d/.test(prefix)) continue;
      const { len } = parsePrefix(prefix);
      if (len > bestLen && covers(prefix, x)) { best = { prefix, ...r }; bestLen = len; }
    }
    return best;
  }

  return {
    AS, hooks, originate, withdrawOwn, setPolicy, setOriginExport, advance, lookup, rov, schedule,
    get routing() { return routing(); },
    nextEventIn: () => (events.size ? events.a[0][0] - now : Infinity),
    get now() { return now; }, get busy() { return events.size > 0; }
  };
}

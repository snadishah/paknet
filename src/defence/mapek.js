// Adaptive defence as a MAPE-K loop (Kephart & Chess 2003, REFERENCES §3–4):
//   Monitor  — flow telemetry from the simulated network (every bundle as it
//              enters: source, destination, size) and BGP route changes
//   Analyse  — detectors: volume (EWMA z-score), source entropy, beacon
//              periodicity, RPKI origin validation
//   Plan     — map a symptom to a response, after a decision delay
//   Execute  — call the effectors the scenario provides (divert to scrubbing,
//              quarantine devices, deploy route origin validation)
//   Knowledge — baselines learned by the detectors, the ROAs, what is protected
// Pure: no three.js, no DOM. The loop never knows which scenario is running.
import { createRateDetector, createEntropyDetector, createBeaconDetector, entropy } from './detectors.js';

/**
 * @param {object} o
 * @param {Set<number>} o.protect          destination nodes whose inbound traffic is watched (data centres)
 * @param {(prefix, origin) => string} o.rov  RPKI validation: 'valid' | 'invalid' | 'notfound'
 * @param {object} o.effectors             { divert(target), quarantine(src, dstAddr), deployRov() }
 * @param {object} o.params                { windowMs, planMs }
 */
export function createMapeK({ protect, rov, effectors, params, nameOf = x => String(x) }) {
  const P = { windowMs: 0.5, planMs: 0.5, ...params };
  const rate = createRateDetector({ minRate: 200 }), ent = createEntropyDetector(), beacon = createBeaconDetector();
  const hooks = { event: null };
  const log = [];
  const handled = new Set();  // incident keys already planned
  const pending = [];         // planned actions: { at, key, fn, text }
  let enabled = true, win = { start: null, dst: new Map(), src: new Map() };

  const say = (t, phase, text, extra = {}) => { const e = { t, phase, text, ...extra }; log.push(e); hooks.event?.(e); return e; };

  /* ---------- Monitor ---------- */
  function observeFlow(b, now) {
    if (!enabled) return;
    const dst = b.seq[b.seq.length - 1], src = b.seq[0];
    if (protect.has(dst)) {
      win.dst.set(dst, (win.dst.get(dst) || 0) + b.gbit);
      if (!win.src.has(dst)) win.src.set(dst, new Map());
      const m = win.src.get(dst); m.set(src, (m.get(src) || 0) + b.gbit);
    }
    if (b.opt.dstAddr) { // connections to external services
      const key = `${src}>${b.opt.dstAddr}`, r = beacon.observe(key, now);
      if (r.alarm) symptom(now, 'beacon', key, `${nameOf(src)} contacts ${b.opt.dstAddr} every ${(r.period * 1000).toFixed(0)} µs of network time (gap variation ${(r.cv * 100).toFixed(0)}%): machine-like beaconing.`, () => effectors.quarantine(src, b.opt.dstAddr), `Quarantine devices near ${nameOf(src)} that beacon to ${b.opt.dstAddr}; require step-up authentication; block the server at the edge.`);
    }
  }
  function observeRoute(asn, prefix, best, now) {
    if (!enabled || !best) return;
    const origin = best.path[best.path.length - 1];
    if (rov(prefix, origin) === 'invalid') {
      symptom(now, 'hijack', `${prefix}|${origin}`, `AS${asn} now uses ${prefix} originated by AS${origin}, but the RPKI record says only YouTube may originate it: <i>Invalid</i>.`, () => effectors.deployRov(), 'Deploy route origin validation at the large carriers: drop Invalid routes.', 'Carriers instructed to deploy route origin validation; their filters take effect after a few minutes.');
    }
  }

  /* ---------- Analyse (once per telemetry window) ---------- */
  function tick(now) {
    if (win.start == null) win.start = now;
    // execute what is due
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i].at <= now) { const a = pending.splice(i, 1)[0]; a.fn(); say(now, 'execute', a.text, { kind: a.kind }); }
    if (now - win.start < P.windowMs) return;
    const dt = now - win.start;
    for (const dst of protect) {
      const gbps = (win.dst.get(dst) || 0) / dt * 1000; // Gbit per ms → Gbps
      const r = rate.observe(dst, gbps);
      const e = ent.observe(dst, win.src.get(dst) || new Map());
      if (r.alarm && e.alarm) {
        const n = (win.src.get(dst) || new Map()).size;
        symptom(now, 'ddos', `ddos|${dst}`, `${nameOf(dst)} receives ${(gbps / 1000).toFixed(1)} Tbps (normal ${(r.mean / 1000).toFixed(2)}, z = ${r.score.toFixed(0)}) from ${n} sources (entropy ${e.h.toFixed(1)} bits, normally ${e.base.toFixed(1)}).`, () => effectors.divert(dst), `Divert traffic for ${nameOf(dst)} to the scrubbing centre; forward only clean traffic.`);
      }
    }
    win = { start: now, dst: new Map(), src: new Map() };
  }

  /* ---------- Plan ---------- */
  function symptom(now, kind, key, analysis, fn, plan, done) {
    if (handled.has(key)) return; handled.add(key);
    say(now, 'analyse', analysis, { kind });
    say(now, 'plan', plan, { kind });
    pending.push({ at: now + P.planMs, fn, text: done || plan.replace(/\.$/, '') + ': done.', kind });
  }

  function reset() { handled.clear(); pending.length = 0; log.length = 0; }
  return { observeFlow, observeRoute, tick, reset, log, hooks, entropy, set enabled(v) { enabled = v; }, get enabled() { return enabled; } };
}

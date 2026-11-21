// Anomaly detectors for the adaptive defence. Pure: no three.js, no DOM.
// Sources (docs/REFERENCES.md §3): EWMA / z-score rate anomaly detection;
// entropy of traffic feature distributions (Lakhina, Crovella, Diot, SIGCOMM 2005).

// Shannon entropy (bits) of a Map of counts or weights.
export function entropy(counts) {
  let total = 0; for (const v of counts.values()) total += v;
  if (!total) return 0;
  let h = 0; for (const v of counts.values()) if (v > 0) { const p = v / total; h -= p * Math.log2(p); }
  return h;
}

/**
 * Volume anomaly per key (e.g. per destination): EWMA mean and variance of the
 * rate in each window; alarm when the rate is far above normal.
 * z = (x − mean) / max(std, floor), floor = floorFrac × mean + minStd.
 */
export function createRateDetector({ alpha = 0.1, z = 6, minRate = 100, floorFrac = 0.1, minStd = 20, warmup = 5 } = {}) {
  const st = new Map(); // key → { mean, varr, n }
  function observe(key, x) {
    let s = st.get(key); if (!s) st.set(key, s = { mean: 0, varr: 0, n: 0 });
    const std = Math.sqrt(s.varr), floor = floorFrac * s.mean + minStd;
    const score = (x - s.mean) / Math.max(std, floor);
    const alarm = s.n >= warmup && x >= minRate && score >= z;
    if (!alarm) { // learn only from normal windows, so an attack doesn't become the baseline
      const d = x - s.mean; s.mean += alpha * d; s.varr = (1 - alpha) * (s.varr + alpha * d * d); s.n++;
    }
    return { alarm, score, mean: s.mean };
  }
  return { observe, state: st };
}

/**
 * Source-distribution anomaly per key: compares the entropy of where traffic
 * comes from with its baseline. A flood from many unusual sources raises it.
 */
// jump = 1 bit: the model sees sources as ingress points and cities, not millions of
// addresses, so a flood shows up as a smaller entropy rise than in real traffic (assumption).
export function createEntropyDetector({ alpha = 0.1, jump = 1, warmup = 5 } = {}) {
  const st = new Map(); // key → { base, n }
  function observe(key, sources) {
    const h = entropy(sources);
    let s = st.get(key); if (!s) st.set(key, s = { base: h, n: 0 });
    const delta = h - s.base, alarm = s.n >= warmup && delta >= jump;
    if (!alarm) { s.base += alpha * (h - s.base); s.n++; }
    return { alarm, h, base: s.base, delta };
  }
  return { observe, state: st };
}

/**
 * Beaconing: malware "phones home" at a fixed period, so the gaps between its
 * connections are nearly constant. Ordinary traffic arrives at random
 * (coefficient of variation of the gaps ≈ 1 for Poisson arrivals).
 */
export function createBeaconDetector({ samples = 12, cvMax = 0.15 } = {}) {
  const st = new Map(); // key → recent arrival times
  function observe(key, t) {
    let a = st.get(key); if (!a) st.set(key, a = []);
    a.push(t); if (a.length > samples + 1) a.shift();
    if (a.length < samples + 1) return { alarm: false };
    const gaps = a.slice(1).map((x, i) => x - a[i]);
    const m = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((s, g) => s + (g - m) ** 2, 0) / gaps.length);
    const cv = m > 0 ? sd / m : Infinity;
    return { alarm: cv <= cvMax, cv, period: m };
  }
  return { observe, state: st };
}

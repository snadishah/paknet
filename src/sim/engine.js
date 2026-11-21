// Discrete-event network engine. Pure: no three.js, no DOM.
//
// Time is network time in milliseconds. Every directed link has a capacity
// (Gbps), a propagation delay (ms), a FIFO buffer (Gbit) and tail drop.
// A bundle follows a node sequence; at each hop it waits in the outgoing
// link's queue, is transmitted (size / capacity), then propagates.
//
//   inject → [queue] → transmit (txdone) → on the wire → arrive → next hop … → deliver
//                └ buffer full: tail drop        └ link cut: dropped

// Min-heap of events ordered by time, then by insertion order (keeps FIFO
// behaviour deterministic when events share a timestamp).
class EventHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  peek() { return this.a[0]; }
  push(ev) {
    const a = this.a; a.push(ev); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (!less(a[i], a[p])) break; [a[i], a[p]] = [a[p], a[i]]; i = p; }
  }
  pop() {
    const a = this.a; const top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < a.length && less(a[l], a[s])) s = l; if (r < a.length && less(a[r], a[s])) s = r; if (s === i) break; [a[i], a[s]] = [a[s], a[i]]; i = s; }
    }
    return top;
  }
}
const less = (x, y) => x.t < y.t || (x.t === y.t && x.n < y.n);

/**
 * @param {object} o
 * @param {(e, dir) => number} o.capacityGbps  capacity of edge e in direction dir (0: a→b, 1: b→a)
 * @param {(e) => number} o.delayMs            one-way propagation delay of edge e
 * @param {(e) => boolean} o.usable            false if the edge is down
 * @param {number} o.bufferMs                  buffer = bufferMs of line rate
 */
export function createEngine({ capacityGbps, delayMs, usable = () => true, bufferMs = 5 }) {
  let now = 0, n = 0, nextId = 1;
  const events = new EventHeap();
  const links = new Map();
  const bundles = new Set();
  const hooks = { deliver: null, drop: null };
  const counters = { offered: 0, delivered: 0, dropped: 0, deliveredGbit: {}, droppedBy: { queue: 0, down: 0, blocked: 0, blackhole: 0 } };

  const at = (t, type, a, b) => events.push({ t, n: n++, type, a, b });

  function link(e, dir) {
    const key = e.id * 2 + dir;
    let L = links.get(key);
    if (!L) {
      const cap = capacityGbps(e, dir);
      L = { key, e, dir, cap, prop: delayMs(e), bufGbit: cap * bufferMs / 1000, queue: [], qGbit: 0, busy: null, busyMs: 0, onWire: new Set() };
      links.set(key, L);
    }
    return L;
  }

  /**
   * Put a bundle into the network at node seq[0], now.
   * @param {number[]} seq   node ids, seq.length === edges.length + 1
   * @param {object[]} edges edge objects joining consecutive nodes
   * @param {object} opt     { gbit, cls, blocked, blackhole, ...anything the caller wants back }
   */
  function inject(seq, edges, opt = {}) {
    const b = { id: nextId++, seq, edges, hop: 0, gbit: opt.gbit ?? 0.1, cls: opt.cls || 'dom', state: 'new', born: now, link: null, opt };
    bundles.add(b); counters.offered++;
    if (opt.blocked) { drop(b, 'blocked'); return b; }
    arriveAtNode(b);
    return b;
  }

  function arriveAtNode(b) {
    if (b.hop >= b.edges.length) return deliver(b);
    const e = b.edges[b.hop], dir = b.seq[b.hop] === e.a ? 0 : 1;
    if (!usable(e)) return drop(b, 'down');
    const L = link(e, dir);
    b.link = L;
    if (!L.busy) return startTx(L, b);
    if (L.qGbit + b.gbit > L.bufGbit + 1e-9) return drop(b, 'queue');
    b.state = 'queued'; L.queue.push(b); L.qGbit += b.gbit;
  }

  function startTx(L, b) {
    const tx = b.gbit / L.cap * 1000;
    L.busy = b; b.state = 'tx'; b.tTx = now; b.txMs = tx;
    at(now + tx, 'txdone', L, b);
  }

  function onTxDone(L, b) {
    L.busyMs += b.txMs; L.busy = null;
    if (b.state === 'tx') {
      b.state = 'wire'; b.tWire = now; b.tArrive = now + L.prop; L.onWire.add(b);
      at(b.tArrive, 'arrive', L, b);
    }
    while (L.queue.length && !L.busy) {
      const nx = L.queue.shift(); L.qGbit -= nx.gbit;
      if (!usable(L.e)) drop(nx, 'down'); else startTx(L, nx);
    }
  }

  function onArrive(L, b) {
    L.onWire.delete(b);
    if (b.state !== 'wire') return;
    b.hop++; b.link = null; arriveAtNode(b);
  }

  function deliver(b) {
    b.state = 'done'; b.delay = now - b.born; bundles.delete(b);
    if (b.opt.blackhole) { counters.dropped++; counters.droppedBy.blackhole++; }
    else { counters.delivered++; counters.deliveredGbit[b.cls] = (counters.deliveredGbit[b.cls] || 0) + b.gbit; }
    hooks.deliver?.(b);
  }

  function drop(b, why) {
    if (b.state === 'dropped' || b.state === 'done') return;
    if (b.state === 'queued' && b.link) { const L = b.link; const i = L.queue.indexOf(b); if (i >= 0) { L.queue.splice(i, 1); L.qGbit -= b.gbit; } }
    if (b.state === 'wire' && b.link) b.link.onWire.delete(b);
    b.state = 'dropped'; b.why = why; bundles.delete(b);
    counters.dropped++; counters.droppedBy[why] = (counters.droppedBy[why] || 0) + 1;
    hooks.drop?.(b);
  }

  // A link was cut: everything queued, being transmitted or on the wire is lost.
  function cut(e) {
    for (const dir of [0, 1]) {
      const L = links.get(e.id * 2 + dir); if (!L) continue;
      for (const b of [...L.queue]) drop(b, 'down');
      for (const b of [...L.onWire]) drop(b, 'down');
      if (L.busy) drop(L.busy, 'down');
    }
  }

  // Process every event up to time t (ms), then set the clock to t.
  function run(t) {
    while (events.size && events.peek().t <= t) {
      const ev = events.pop(); now = ev.t;
      if (ev.type === 'txdone') onTxDone(ev.a, ev.b); else if (ev.type === 'arrive') onArrive(ev.a, ev.b);
    }
    if (t > now) now = t;
  }

  return { inject, run, cut, links, bundles, counters, hooks, get now() { return now; }, link };
}

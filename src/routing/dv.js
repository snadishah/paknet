// Distance-vector routing (RIP-style). Pure: no three.js, no DOM.
//
// RFC 2453 (RIP v2), simplified:
//   - metric = hop count; 16 = infinity (unreachable)
//   - routers exchange their whole vector with every neighbour once per round
//     (rounds are synchronous: everyone sends, then everyone updates)
//   - a route learned from neighbour v is always replaced by v's latest
//     advertisement, even if worse; otherwise only a strictly better route wins
//   - split horizon: don't advertise a route back to the neighbour it was learned from
//   - poison reverse: advertise it back as 16 instead of omitting it
//   - a router notices a dead link at the start of the next round (like an
//     interface going down) and marks routes through it as 16
//
// Access cities are hosts behind their hub router (like prefixes behind a
// router), and the 26-link microwave backup chain is one logical link, so
// the network stays within RIP's 15-hop limit.

export const INFINITY = 16;
export const TTL = 32; // forwarding hop limit for a bundle (IP TTL, simplified)

const ROUTER_TIERS = new Set(['core', 'agg', 'cls', 'ixp', 'dc', 'intl']);
const LINK_TYPES = new Set(['fiber', 'metro', 'microwave', 'aerial', 'xborder', 'subsea', 'planned']);

/**
 * @param {object} G      graph from buildTopology()
 * @param {object} o
 * @param {(e) => boolean} o.usable
 * @param {boolean} [o.splitHorizon]
 * @param {boolean} [o.poisonReverse]
 */
export function createDV(G, o) {
  const { usable } = o;
  const opts = { splitHorizon: !!o.splitHorizon, poisonReverse: !!o.poisonReverse };
  const routers = G.nodes.filter(n => ROUTER_TIERS.has(n.tier)).map(n => n.id);
  const R = routers.length, idx = new Map(routers.map((id, i) => [id, i]));
  const stub = routers.map(id => G.nodes[id].tier === 'intl'); // international endpoints never carry transit

  // links between routers: real edges, plus the microwave chain as one logical link.
  // Parallel links to the same neighbour (e.g. several cables to one endpoint) are
  // grouped: the neighbour is reachable while any of them is up.
  const nbrs = routers.map(() => []);
  const addLink = (a, b, edges) => {
    const i = idx.get(a), j = idx.get(b); if (i == null || j == null) return;
    const L = { a, b, edges };
    for (const [x, y] of [[i, j], [j, i]]) { let n = nbrs[x].find(n => n.j === y); if (!n) nbrs[x].push(n = { j: y, links: [] }); n.links.push(L); }
  };
  for (const e of G.edges) if (LINK_TYPES.has(e.type) && idx.has(e.a) && idx.has(e.b)) addLink(e.a, e.b, [e]);
  const chain = G.edges.filter(e => e.type === 'mwbackup');
  if (chain.length) {
    const towerIds = new Set(G.towers.map(t => t.id));
    const ends = chain.flatMap(e => [e.a, e.b]).filter(id => !towerIds.has(id));
    if (ends.length === 2) addLink(ends[0], ends[1], orderChain(chain, ends[0]));
  }
  const linkUp = L => L.edges.every(usable);
  const nbrUp = n => n.links.some(linkUp);
  const upLink = n => n.links.find(linkUp);

  // tables: dist[i][k] hops from router i to router k, via[i][k] = neighbour index or -1
  let dist, via;
  let round = 0, lastChange = 0;
  function reset() {
    dist = routers.map((_, i) => { const a = new Uint8Array(R).fill(INFINITY); a[i] = 0; return a; });
    via = routers.map(() => new Int16Array(R).fill(-1));
    round = 0; lastChange = 0;
  }
  reset();

  function step() {
    round++;
    let changed = false;
    // 1. dead links: routes through them become unreachable
    for (let i = 0; i < R; i++) for (const n of nbrs[i]) if (!nbrUp(n)) {
      const d = dist[i], v = via[i], j = n.j;
      for (let k = 0; k < R; k++) if (v[k] === j && d[k] !== INFINITY) { d[k] = INFINITY; v[k] = -1; changed = true; }
    }
    // 2. everyone sends a snapshot of their vector
    const advD = dist.map(a => a.slice()), advV = via.map(a => a.slice());
    // 3. everyone updates from each neighbour on a live link
    for (let i = 0; i < R; i++) {
      const d = dist[i], v = via[i];
      for (const n of nbrs[i]) {
        if (!nbrUp(n)) continue;
        const j = n.j, ad = advD[j], av = advV[j];
        for (let k = 0; k < R; k++) {
          if (k === i) continue;
          if (stub[j] && k !== j) continue; // endpoints only advertise themselves
          let m = ad[k];
          if (av[k] === i) { // j learned this route from me
            if (opts.poisonReverse) m = INFINITY;
            else if (opts.splitHorizon) continue;
          }
          const c = Math.min(INFINITY, m + 1);
          if (v[k] === j) { if (d[k] !== c) { d[k] = c; if (c === INFINITY) v[k] = -1; changed = true; } }
          else if (c < d[k]) { d[k] = c; v[k] = j; changed = true; }
        }
      }
    }
    if (changed) lastChange = round;
    return changed;
  }

  // Run rounds until nothing changes (or a cap). Returns the number of rounds run.
  function converge(max = 100) { let n = 0; while (n < max) { n++; if (!step()) break; } return n; }

  const routerOf = id => idx.get(id);
  const distance = (a, b) => dist[idx.get(a)][idx.get(b)];
  const nextHop = (a, b) => { const v = via[idx.get(a)][idx.get(b)]; return v < 0 ? null : routers[v]; };

  /**
   * Follow next hops from router a towards router b.
   * @returns {{seq:number[], edges:object[], fate:'ok'|'unreachable'|'ttl'}}
   */
  function forward(a, b) {
    const seq = [a], edges = []; let cur = a, hops = 0;
    const kb = idx.get(b);
    while (cur !== b) {
      const i = idx.get(cur);
      if (hops >= TTL) return { seq, edges, fate: 'ttl' };
      const j = via[i][kb];
      if (j < 0 || dist[i][kb] >= INFINITY) return { seq, edges, fate: 'unreachable' };
      const link = upLink(nbrs[i].find(n => n.j === j));
      if (!link) return { seq, edges, fate: 'unreachable' };
      const es = link.a === cur ? link.edges : [...link.edges].reverse();
      for (const e of es) { const nxt = e.a === seq[seq.length - 1] ? e.b : e.a; edges.push(e); seq.push(nxt); }
      cur = routers[j]; hops++;
    }
    return { seq, edges, fate: 'ok' };
  }

  return {
    routers, opts, step, converge, reset, forward, distance, nextHop, routerOf,
    isRouter: id => idx.has(id),
    get round() { return round; }, get lastChange() { return lastChange; }
  };
}

// Order the microwave chain's edges as a walk starting at node `start`.
function orderChain(chain, start) {
  const out = [], left = new Set(chain); let cur = start;
  while (left.size) {
    const e = [...left].find(x => x.a === cur || x.b === cur); if (!e) break;
    out.push(e); left.delete(e); cur = e.a === cur ? e.b : e.a;
  }
  return out;
}

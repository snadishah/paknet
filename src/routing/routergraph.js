// The graph routing protocols run on. Pure: no three.js, no DOM.
//
// - Routers: core and aggregation routers, landing stations, IXPs, data centres
//   and international endpoints. Access cities are hosts behind their hub.
// - International endpoints are stubs: they never carry transit.
// - The 26-link microwave backup chain is one logical link.
// - Parallel links to the same neighbour (e.g. several cables to one endpoint)
//   are grouped: the neighbour is reachable while any of them is up.

const ROUTER_TIERS = new Set(['core', 'agg', 'cls', 'ixp', 'dc', 'intl']);
const LINK_TYPES = new Set(['fiber', 'metro', 'microwave', 'aerial', 'xborder', 'subsea', 'planned']);

/**
 * @returns {{ routers:number[], idx:Map<number,number>, stub:boolean[],
 *   nbrs: {j:number, links:{a:number,b:number,edges:object[]}[]}[][], linksOf: Map<object, object[]> }}
 *   nbrs[i] lists router i's neighbours (by index) with the links to each.
 *   linksOf maps a physical edge to the logical links that use it.
 */
export function buildRouterGraph(G) {
  const routers = G.nodes.filter(n => ROUTER_TIERS.has(n.tier)).map(n => n.id);
  const idx = new Map(routers.map((id, i) => [id, i]));
  const stub = routers.map(id => G.nodes[id].tier === 'intl');
  const nbrs = routers.map(() => []);
  const linksOf = new Map();
  const addLink = (a, b, edges) => {
    const i = idx.get(a), j = idx.get(b); if (i == null || j == null) return;
    const L = { a, b, edges };
    for (const e of edges) { if (!linksOf.has(e)) linksOf.set(e, []); linksOf.get(e).push(L); }
    for (const [x, y] of [[i, j], [j, i]]) { let n = nbrs[x].find(n => n.j === y); if (!n) nbrs[x].push(n = { j: y, links: [] }); n.links.push(L); }
  };
  for (const e of G.edges) if (LINK_TYPES.has(e.type) && idx.has(e.a) && idx.has(e.b)) addLink(e.a, e.b, [e]);
  const chain = G.edges.filter(e => e.type === 'mwbackup');
  if (chain.length) {
    const towerIds = new Set(G.towers.map(t => t.id));
    const ends = chain.flatMap(e => [e.a, e.b]).filter(id => !towerIds.has(id));
    if (ends.length === 2) addLink(ends[0], ends[1], orderChain(chain, ends[0]));
  }
  return { routers, idx, stub, nbrs, linksOf };
}

// Edges of logical link L walked from router `from`, appended to seq/edges.
export function walkLink(L, from, seq, edges) {
  const es = L.a === from ? L.edges : [...L.edges].reverse();
  for (const e of es) { const nxt = e.a === seq[seq.length - 1] ? e.b : e.a; edges.push(e); seq.push(nxt); }
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

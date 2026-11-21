// The autonomous systems PAKNET simulates and how they connect.
// Sources: docs/REFERENCES.md §2 (ASNs from registries; relationships INFERRED by
// CAIDA AS Rank, dataset 2026-11-01). Anything marked "assumption" is not sourced.
//
// rel: 'p2c' = a is the provider of b; 'p2p' = settlement-free peers.

export const ASES = [
  // Pakistan
  { asn: 17557, name: 'PTCL', kind: 'pk', op: 'PTCL' },
  { asn: 38193, name: 'TWA', kind: 'pk', op: 'TWA' },
  { asn: 9541, name: 'Cybernet', kind: 'pk', op: 'Cybernet' },
  { asn: 23674, name: 'Nayatel', kind: 'pk', op: 'Nayatel' },
  { asn: 9260, name: 'Multinet', kind: 'pk', op: 'Multinet' },
  { asn: 38264, name: 'Wateen', kind: 'pk', op: 'Wateen' },
  { asn: 18053, name: 'SCO', kind: 'pk', op: 'SCO' },
  // international transit (large carriers that PTCL / TWA buy from, per CAIDA)
  { asn: 3491, name: 'PCCW Global', kind: 'transit' },
  { asn: 3356, name: 'Level3 (Lumen)', kind: 'transit' },
  { asn: 1299, name: 'Arelion', kind: 'transit' },
  { asn: 174, name: 'Cogent', kind: 'transit' },
  // content
  { asn: 36561, name: 'YouTube', kind: 'content' },
  // the rest of the world's access networks, aggregated (private-use ASNs: not real networks)
  { asn: 64601, name: 'Access ISPs · Europe', kind: 'world', share: 0.35 },
  { asn: 64602, name: 'Access ISPs · Americas', kind: 'world', share: 0.4 },
  { asn: 64603, name: 'Access ISPs · Asia-Pacific', kind: 'world', share: 0.25 }
];

export const AS_LINKS = [
  // PTCL's providers: a subset of its 13 inferred upstreams, incl. PCCW (the 2008 path)
  { a: 3491, b: 17557, rel: 'p2c' }, { a: 3356, b: 17557, rel: 'p2c' }, { a: 1299, b: 17557, rel: 'p2c' }, { a: 174, b: 17557, rel: 'p2c' },
  // TWA's providers (inferred)
  { a: 3356, b: 38193, rel: 'p2c' }, { a: 174, b: 38193, rel: 'p2c' },
  // Pakistani ISPs buying from PTCL and/or TWA (inferred)
  { a: 17557, b: 9541, rel: 'p2c' }, { a: 38193, b: 9541, rel: 'p2c' }, { a: 3356, b: 9541, rel: 'p2c' }, { a: 1299, b: 9541, rel: 'p2c' },
  { a: 17557, b: 23674, rel: 'p2c' }, { a: 38193, b: 23674, rel: 'p2c' },
  { a: 17557, b: 9260, rel: 'p2c' }, { a: 38193, b: 9260, rel: 'p2c' },
  { a: 38193, b: 38264, rel: 'p2c' },
  { a: 38193, b: 18053, rel: 'p2c' },
  // the large carriers peer with each other (assumption: settlement-free core)
  { a: 3491, b: 3356, rel: 'p2p' }, { a: 3491, b: 1299, rel: 'p2p' }, { a: 3491, b: 174, rel: 'p2p' },
  { a: 3356, b: 1299, rel: 'p2p' }, { a: 3356, b: 174, rel: 'p2p' }, { a: 1299, b: 174, rel: 'p2p' },
  // YouTube in 2008: multihomed to two carriers (assumption; its 2008 upstreams are not in our sources)
  { a: 3356, b: 36561, rel: 'p2c' }, { a: 1299, b: 36561, rel: 'p2c' },
  // world access networks buy transit from the carriers (assumption)
  { a: 1299, b: 64601, rel: 'p2c' }, { a: 3356, b: 64601, rel: 'p2c' },
  { a: 3356, b: 64602, rel: 'p2c' }, { a: 174, b: 64602, rel: 'p2c' },
  { a: 3491, b: 64603, rel: 'p2c' }, { a: 174, b: 64603, rel: 'p2c' }
];

// Prefixes in the 2008 story (REFERENCES §1.7).
export const YT_PREFIX = '208.65.152.0/22';      // YouTube's covering prefix (AS36561 in 2008)
export const HIJACK_PREFIX = '208.65.153.0/24';  // what PTCL announced to block YouTube
export const YT_25S = ['208.65.153.0/25', '208.65.153.128/25']; // YouTube's counter-move
export const YT_ADDR = '208.65.153.238';         // an address inside the /24 (youtube.com's then; illustrative)

// What each customer is registered to announce, used by providers that filter
// their customers' announcements (a prefix filter). PTCL's real list is ~7,000
// prefixes; one placeholder stands for it.
export const REGISTERED = {
  17557: ['PTCL-ALLOCATIONS'], 38193: ['TWA-ALLOCATIONS'], 9541: [], 23674: [], 9260: [], 38264: [], 18053: [],
  36561: [YT_PREFIX, HIJACK_PREFIX, ...YT_25S], 64601: [], 64602: [], 64603: []
};

// Route Origin Authorisation for YouTube's prefix. RPKI did not exist in 2008:
// using it is a WHAT-IF with today's rules (today the /22 has ROAs, REFERENCES §0 #10).
export const ROAS = [{ prefix: YT_PREFIX, maxLength: 22, asn: 36561 }];

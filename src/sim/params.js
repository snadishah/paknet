// Model parameters and representative figures. Every value here has an entry
// in docs/REFERENCES.md; keep the two in sync.

// Propagation in fibre: ~5 µs per km (refractive index ≈ 1.47). REFERENCES §3.
export const FIBRE_US_PER_KM = 5;

// Fibre route length ÷ straight-line distance. Singla et al. (HotNets 2014)
// found 1.5–2× road distance; 1.5 is a labelled assumption. REFERENCES §0 #12, §3.
export const ROUTE_FACTOR = 1.5;

// One-way propagation delay in ms for a path length in km.
export const propDelayMs = km => km * ROUTE_FACTOR * FIBRE_US_PER_KM / 1000;

// Representative lit international capacity in Tbps. Sources range from about
// 13 Tbps active (PTA, ~late 2025) to 7.7 active / 17.7 total (PACRA, FY23).
// REFERENCES §0 #9 and §1.1.
export const INTL_CAPACITY_TBPS = 13;

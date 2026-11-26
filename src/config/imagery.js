// Imagery providers: the ONE place for tile URLs, keys, zoom limits and credits.
// Switch the provider order or swap a service here; nothing else needs to change.
//
// Keys come from .env at build time (scripts/build.mjs replaces __ARCGIS_KEY__ and
// __MAPTILER_KEY__); .env is git-ignored and never committed. With no key the app
// falls back down the chain: Esri → MapTiler → EOX Sentinel-2 → the NASA globe.
// Note: a key used in the browser can be read by anyone who has the page, so a
// build made with a key must not be published on a public website.
/* global __ARCGIS_KEY__, __MAPTILER_KEY__, __ESRI_LABELS_OK__ */
const ARCGIS_KEY = typeof __ARCGIS_KEY__ === 'string' ? __ARCGIS_KEY__ : '';
const MAPTILER_KEY = typeof __MAPTILER_KEY__ === 'string' ? __MAPTILER_KEY__ : '';
// set by the build after one test request: false when the key isn't allowed to use the labels tiles
const ESRI_LABELS_OK = typeof __ESRI_LABELS_OK__ === 'boolean' ? __ESRI_LABELS_OK__ : false;

// tileSize: pixel size of one tile (256 or 512). A 512 px tile covers the same area
// as a 256 px tile one zoom level lower, so the engine requests it one level up.
export const PROVIDERS = [
  {
    id: 'esri', name: 'Esri World Imagery', enabled: !!ARCGIS_KEY, tileSize: 256, maxZoom: 19,
    url: (z, x, y) => `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}?token=${ARCGIS_KEY}`,
    // the credit text the service returns (preferred), with this as the fallback until it arrives
    metadata: `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer?f=json&token=${ARCGIS_KEY}`,
    credit: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community', poweredByEsri: true,
    labels: !ESRI_LABELS_OK ? null : {
      tileSize: 512, maxZoom: 19,
      url: (z, x, y) => `https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/${z}/${y}/${x}?token=${ARCGIS_KEY}`,
      metadata: `https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static?token=${ARCGIS_KEY}`,
      credit: 'Esri, TomTom, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors, and the GIS User Community'
    }
  },
  {
    id: 'maptiler', name: 'MapTiler Satellite Hybrid', enabled: !!MAPTILER_KEY, tileSize: 512, maxZoom: 19,
    url: (z, x, y) => `https://api.maptiler.com/maps/hybrid/${z}/${x}/${y}.jpg?key=${MAPTILER_KEY}`,
    credit: '© MapTiler © OpenStreetMap contributors', labels: null // the hybrid style already has roads and names
  },
  {
    id: 'eox', name: 'Sentinel-2 cloudless', enabled: true, tileSize: 256, maxZoom: 15,
    url: (z, x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${z}/${y}/${x}.jpg`,
    credit: 'Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data)', labels: null
  }
  // last resort: no tiles, the NASA Blue Marble globe stays visible (render/globe.js)
];

// When a provider fails this many tiles in a row (bad key, no network), the next one takes over.
export const FAIL_LIMIT = 4;
// Tile loading limits: visible tiles only, at most 8 requests at once, a session-only memory cache.
export const MAX_CONCURRENT = 8, CACHE_TILES = 260, MAX_DRAWN = 80; // a tilted close-up asks for ~60 tiles; the rest of the scene is ~40 draw calls, so 80 keeps a view ≤ ~130
// Close-up imagery cross-fades in below this camera height (km) over Pakistan and the nearby seas.
export const START_KM = 1500;
export const AREA = { lat0: 12, lat1: 42, lon0: 44, lon1: 82 };

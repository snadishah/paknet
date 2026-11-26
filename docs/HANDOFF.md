# Handoff — round 2, Phase 0 (audit and plan)

**Done**
- `CLAUDE.md`: "THE QUALITY BAR" added word for word as a permanent rule.
- `docs/ROUND2.md`: imagery check, 52-item audit against the Quality Bar (each with its fix and phase), landmark list with how each is built, asset list with sources/licences/sizes, plan and acceptance criteria for Phases 1–5.
- Imagery check with `ARCGIS_KEY` (never printed): Esri World Imagery works; real detail up to z19 in Karachi/Lahore/Islamabad, z18 in Peshawar/Quetta/Hawke's Bay. **Labels overlay fails: HTTP 401, code 498 "Token Invalid"** with every referrer: the key is likely not authorised for Static Basemap Tiles.
- `.env` is ignored and has never been committed; `ARCGIS_KEY` present, no `MAPTILER_KEY`.

**Decisions waiting for you**
1. TeleGeography cable data: (a) archived 2022 CC BY-NC-SA 3.0 data (recommended), (b) hand-traced approximate routes, (c) ask TeleGeography.
2. Esri labels: fix the key's privileges (Static Basemap Tiles) or use our own OSM road/place overlay (planned fallback).
3. The key's referrer is `http://localhost:4173`; the brief says 5173. World Imagery ignores the referrer anyway, so never publish a build with the key.

**Next**: Phase 1 after "approved".

**Files**: CLAUDE.md, docs/ROUND2.md, docs/HANDOFF.md.

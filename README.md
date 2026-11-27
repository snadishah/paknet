# PAKNET — How Pakistan's internet travels

A 3D simulation of Pakistan's internet, built with three.js for a Computer Networks course project. Start from a realistic Earth in space, zoom down to Pakistan and into a city, and watch real simulated traffic travel over cables, routers and a satellite.

## How to run

You need [Node.js](https://nodejs.org) (version 20 or newer).

1. Open a terminal in this folder and install everything once:
   ```
   npm install
   ```
2. Build the app:
   ```
   npm run build
   ```
3. Start the small local web server:
   ```
   npm run preview
   ```
4. Open **http://localhost:4173** in Chrome (or any modern browser).

While you are changing the code, use `npm run dev` instead: it rebuilds whenever you save and serves the app on **http://localhost:5173** (refresh the page to see changes).

The app works offline. Only the close-up satellite photos come from the internet; without a connection you simply see the normal globe. A small spinner (bottom left) shows while photos, buildings or data are still loading.

### Sharper satellite photos (optional: an ArcGIS key)
Without a key the close-up photos come from EOX Sentinel-2 (10 m). With a free ArcGIS Location Platform key you get Esri World Imagery (sharp down to street level):
1. Create a key at developers.arcgis.com → API keys, with the **Basemaps** privilege (and **Static basemap tiles** if you want Esri's road labels), and allow the referrers `http://localhost:4173` and `http://localhost:5173`.
2. Put it in a file called `.env` in this folder: `ARCGIS_KEY=your-key-here` (the file is git-ignored; never commit it).
3. Run `npm run build` again. The build prints only "ArcGIS yes/no", never the key.
A build that contains a key is for your own computer only: don't publish the `dist/` folder.

`npm run verify -- --no-keys` checks the app as it is without any key.

Other commands:
- `npm test` runs the unit tests for the routing and simulation logic.
- `npm run verify` builds the app, opens it in a hidden browser at laptop and phone sizes, takes screenshots and checks for errors, draw calls, a continuous zoom from space to the street, every scenario and the whole "Watch the story" player. The results are in `.verify/`.
- `npm run cables` / `npm run roads` / `npm run buildings` / `npm run streets` re-bake the cable routes (TeleGeography) and the roads, city buildings and city streets (OpenStreetMap).
- `node scripts/look.mjs name=lat,lon,range,heading,tilt …` takes quick headless screenshots of any views into `.verify/` (needs `npm run preview`); `node scripts/sharpness-timing.mjs` measures how soon the imagery is sharp after a flight.
- Add `?perf=1` to the address (e.g. `http://localhost:4173/?perf=1`) and open the browser's developer console (⌥⌘J in Chrome): it logs the frame rate every 2 seconds. Nothing is ever shown on screen.

## How to use it

- **Watch the story** plays the whole story by itself, like a film: from space to Pakistan, a YouTube video travelling to Europe and back, WhatsApp to Dubai, an email to Lahore, PakSat-MM1 up close, then every scenario. Play/pause, previous/next, 0.5×–2× and a chapter list; a click pauses, **Resume** continues, **Esc** leaves. **P** (or the screen button) opens it too.
- **Explore** starts with a short tour (8 steps). Press **?** any time to see it again, or **Skip intro** to go straight in.
- **Drag** to move, **scroll or pinch** to zoom (from space down to a street), **right-drag or two fingers** to tilt and turn.
- **Search** (top left, or press **/**): try "Karachi", "PakSat", "AAE-1", "Lahore office".
- **Click anything** (a city, a cable, a satellite, an office) for a plain-English card. "Expert details" holds the numbers.
- **Offices**: click an office and "Follow its traffic" to see every stop its parcels make (a visual traceroute), all the way along the cable to its landing abroad.
- **PakSat-MM1**: search "PakSat" and press "Look at it up close" to orbit the satellite.
- **What can go wrong?** (top right) plays one of ten short stories: cable cuts, a landslide, attacks, the 2008 YouTube hijack and more.
- **Expert** (top right) brings back the full control panels: routing protocols, metrics, security tables.
- The time bar plays the day faster (1×, 10×, 60×, 1 hour per second); **LIVE** returns to now. Close to the ground the parcels move in slow motion so you can follow them.
- Every view has its own link: copy the address bar to bookmark a moment for your presentation.

## Data sources
- Earth: NASA Blue Marble and Black Marble (public domain; not endorsed by NASA)
- Close-up imagery: Esri World Imagery (Powered by Esri; sources named on screen) with your key, otherwise Sentinel-2 cloudless by EOX (CC BY 4.0)
- Submarine cable routes: © TeleGeography, submarinecablemap.com (CC BY-NC-SA 3.0; SEA-ME-WE 6 and 2Africa's Pakistan branch approximate)
- Roads: © OpenStreetMap contributors (ODbL)
- Satellite orbits: CelesTrak
- Borders: Natural Earth; provinces: Highcharts map collection; cities: GeoNames
- Buildings and city streets: © OpenStreetMap contributors (ODbL); the trees, lamps and cars along the streets are placed by rule (illustrative)
- Font: Inter, shipped with the app (SIL Open Font Licence 1.1)

The internal network topology inside Pakistan is representative, not real. Everything made up for teaching is labelled "illustrative". The 3D buildings, stations and satellites are representative models built in code; from far away the satellites are shown enlarged so you can see them.

See `CLAUDE.md` for the project rules, `docs/REDESIGN.md` for the design and `docs/REFERENCES.md` for every fact and its source.

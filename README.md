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

The app works offline. Only the close-up satellite photos of Pakistan come from the internet; without a connection you simply see the normal globe.

Other commands:
- `npm test` runs the unit tests for the routing and simulation logic.
- `npm run verify` builds the app, opens it in a hidden browser at laptop and phone sizes, takes screenshots and checks for errors. The results are in `.verify/`.
- Add `?perf=1` to the address (e.g. `http://localhost:4173/?perf=1`) and open the browser's developer console (⌥⌘J in Chrome): it logs the frame rate every 2 seconds. Nothing is ever shown on screen.

## How to use it

- **Start** plays a short tour (8 steps). Press **?** any time to see it again, or **Skip intro** to go straight in.
- **Drag** to move, **scroll or pinch** to zoom (from space down to a street), **right-drag or two fingers** to tilt and turn.
- **Search** (top left, or press **/**): try "Karachi", "PakSat", "AAE-1", "Lahore office".
- **Click anything** (a city, a cable, a satellite, an office) for a plain-English card. "Expert details" holds the numbers.
- **Offices**: click an office and "Follow its traffic" to see every stop its parcels make (a visual traceroute).
- **What can go wrong?** (top right) plays one of ten short stories: cable cuts, a landslide, attacks, the 2008 YouTube hijack and more.
- **Presentation mode**: press **P** (or the screen button). Use the arrow keys or a clicker; **Esc** leaves.
- **Expert** (top right) brings back the full control panels: routing protocols, metrics, security tables.
- The time bar plays the day faster (1×, 10×, 60×, 1 hour per second); **LIVE** returns to now. Close to the ground the parcels move in slow motion so you can follow them.
- Every view has its own link: copy the address bar to bookmark a moment for your presentation.

## Data sources
- Earth: NASA Blue Marble and Black Marble (public domain; not endorsed by NASA)
- Close-up imagery: Sentinel-2 cloudless by EOX (CC BY 4.0)
- Satellite orbits: CelesTrak
- Borders: Natural Earth; provinces: Highcharts map collection; cities: GeoNames
- Buildings: © OpenStreetMap contributors (ODbL)

The internal network topology inside Pakistan is representative, not real. Everything made up for teaching is labelled "illustrative".

See `CLAUDE.md` for the project rules, `docs/REDESIGN.md` for the design and `docs/REFERENCES.md` for every fact and its source.

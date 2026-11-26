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
- Add `?perf=1` to the address (e.g. `http://localhost:4173/?perf=1`) to see frame rate and draw calls.

## Data sources
- Earth: NASA Blue Marble and Black Marble (public domain; not endorsed by NASA)
- Close-up imagery: Sentinel-2 cloudless by EOX (CC BY 4.0)
- Satellite orbits: CelesTrak
- Borders: Natural Earth; provinces: Highcharts map collection; cities: GeoNames
- Buildings: © OpenStreetMap contributors (ODbL)

The internal network topology inside Pakistan is representative, not real. Everything made up for teaching is labelled "illustrative".

See `CLAUDE.md` for the project rules, `docs/REDESIGN.md` for the design and `docs/REFERENCES.md` for every fact and its source.

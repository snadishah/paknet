# PAKNET

Pakistan internet traffic & routing simulator, built in three.js. Computer Networks course project, proof of concept.

## Run it
```
npm install
npm run build
```
Then open `dist/index.html` in your browser. Use `npm run dev` to rebuild automatically while you edit.

A prebuilt `dist/index.html` is already included, so you can open it straight away.

## Data sources
- Borders: Natural Earth (via the `world-atlas` package)
- Provinces: Highcharts map collection, derived from Natural Earth
- Cities: GeoNames (via the `all-the-cities` package)

The internal network topology is representative, not real.

See `CLAUDE.md` for the full project context, the design rules and the roadmap.

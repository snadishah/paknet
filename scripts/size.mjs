// Bundle-size report: what is inside dist/assets/main.js (biggest inputs first)
// and the size of every shipped asset. Writes .verify/size.json.
//   npm run size
import * as esbuild from 'esbuild';
import { readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const satShim = {
  name: 'satellite-js-shim',
  setup(build) {
    // same as build.mjs: only the plain-JS parts of satellite.js
    build.onResolve({ filter: /^satellite\.js$/ }, () => ({ path: 'satellite-js-shim', namespace: 'sat-shim' }));
    build.onLoad({ filter: /.*/, namespace: 'sat-shim' }, () => {
      const d = join(root, 'node_modules/satellite.js/dist').replace(/\\/g, '/');
      return { contents: `export { json2satrec, twoline2satrec } from '${d}/io.js';\nexport { propagate, sgp4, gstime } from '${d}/propagation.js';\nexport { eciToGeodetic, eciToEcf, degreesLat, degreesLong, geodeticToEcf } from '${d}/transforms.js';`, loader: 'js', resolveDir: d };
    });
  }
};
const r = await esbuild.build({ entryPoints: [join(root, 'src/main.js')], bundle: true, minify: true, format: 'esm', write: false, metafile: true, loader: { '.json': 'json' }, plugins: [satShim], logLevel: 'silent', outdir: join(root, '.verify/size') });
const out = Object.values(r.metafile.outputs).find(o => o.entryPoint);
const groups = {};
for (const [file, v] of Object.entries(out.inputs)) {
  const g = file.includes('node_modules/three/') ? 'three.js' : file.includes('node_modules/satellite.js') ? 'satellite.js' : file.startsWith('data/') ? file : file.startsWith('src/') ? file.split('/').slice(0, 2).join('/') + '/' : file;
  groups[g] = (groups[g] || 0) + v.bytesInOutput;
}
const rows = Object.entries(groups).sort((a, b) => b[1] - a[1]);
const list = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? list(p) : [[relative(join(root, 'dist'), p), statSync(p).size]]; });
let assets = []; try { assets = list(join(root, 'dist')).sort((a, b) => b[1] - a[1]); } catch { /* not built yet */ }
const kb = b => (b / 1024).toFixed(0).padStart(6) + ' KB';
console.log(`main.js (minified): ${kb(out.bytes)}`); rows.slice(0, 12).forEach(([k, b]) => console.log(`  ${kb(b)}  ${k}`));
console.log(`dist/ total: ${kb(assets.reduce((s, a) => s + a[1], 0))}`); assets.slice(0, 10).forEach(([k, b]) => console.log(`  ${kb(b)}  ${k}`));
mkdirSync(join(root, '.verify'), { recursive: true });
writeFileSync(join(root, '.verify/size.json'), JSON.stringify({ mainBytes: out.bytes, inputs: Object.fromEntries(rows), assets: Object.fromEntries(assets) }, null, 1));

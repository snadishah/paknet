// Builds the app into dist/: index.html (src/template.html with the source list
// injected) + assets/ (the esbuild bundle, the satellite worker, textures).
//   npm run build        -> one-off build
//   npm run dev          -> rebuild on every save and serve on :5173
//   npm run build:v1     -> build the archived neon v1 into dist/v1.html (single file)
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const v1 = process.argv.includes('--v1');
const watch = process.argv.includes('--watch');
const dist = join(root, 'dist');

// The Sources screen is generated from docs/REFERENCES.md ("## Source list"):
// groups under **bold** headings, one "- S01 — text. URL" line per source.
function readSources() {
  const md = readFileSync(join(root, 'docs/REFERENCES.md'), 'utf8');
  const part = md.slice(md.indexOf('## Source list'));
  const groups = []; let g = null;
  for (const line of part.split(/\r?\n/)) {
    const head = line.match(/^\*\*(.+?)\*\*/); if (head) { g = { title: head[1], items: [] }; groups.push(g); continue; }
    const m = line.match(/^- (S\d+[a-z]?) — (.+)$/); if (!m || !g) continue;
    const url = (m[2].match(/https?:\/\/\S+/) || [null])[0];
    g.items.push({ id: m[1], text: m[2].replace(/\s*https?:\/\/\S+/g, '').trim(), url: url && url.replace(/[).,]+$/, '') });
  }
  return groups;
}

// satellite.js 7 re-exports an optional WASM build that pulls in node:worker_threads,
// which esbuild can't bundle for the browser. Point the import at the plain-JS parts.
const satShim = {
  name: 'satellite-js-shim',
  setup(build) {
    build.onResolve({ filter: /^satellite\.js$/ }, () => ({ path: 'satellite-js-shim', namespace: 'sat-shim' }));
    build.onLoad({ filter: /.*/, namespace: 'sat-shim' }, () => {
      const d = join(root, 'node_modules/satellite.js/dist').replace(/\\/g, '/');
      return {
        contents: `export { json2satrec, twoline2satrec } from '${d}/io.js';
export { propagate, sgp4, gstime } from '${d}/propagation.js';
export { eciToGeodetic, eciToEcf, degreesLat, degreesLong, geodeticToEcf } from '${d}/transforms.js';`,
        loader: 'js', resolveDir: d
      };
    });
  }
};

function dirSize(d) { let s = 0; for (const f of readdirSync(d)) { const p = join(d, f); const st = statSync(p); s += st.isDirectory() ? dirSize(p) : st.size; } return s; }

const page = {
  name: 'page',
  setup(build) {
    build.onEnd(result => {
      if (result.errors.length) return;
      const html = readFileSync(join(root, 'src/template.html'), 'utf8')
        .replace('/*SOURCES*/', () => JSON.stringify(readSources()).replace(/</g, '\\u003c'));
      mkdirSync(join(dist, 'assets'), { recursive: true });
      if (existsSync(join(root, 'assets'))) cpSync(join(root, 'assets'), join(dist, 'assets'), { recursive: true });
      // baked city buildings are loaded at runtime (only when you zoom into a city)
      cpSync(join(root, 'src/data/satellites.json'), join(dist, 'assets/satellites.json'));
      if (existsSync(join(root, 'src/data/cities'))) cpSync(join(root, 'src/data/cities'), join(dist, 'assets/cities'), { recursive: true });
      writeFileSync(join(dist, 'index.html'), html);
      console.log(`built dist/ (${(dirSize(dist) / 1048576).toFixed(2)} MB)`);
    });
  }
};

// The archived v1 stays a single self-contained file.
const inlineV1 = {
  name: 'inline-v1',
  setup(build) {
    build.onEnd(result => {
      if (result.errors.length) return;
      const js = result.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
      const html = readFileSync(join(root, 'archive/v1/template.html'), 'utf8').replace('<script>/*BUNDLE*/</script>', () => `<script>${js}</script>`);
      mkdirSync(dist, { recursive: true }); writeFileSync(join(dist, 'v1.html'), html); console.log('built dist/v1.html');
    });
  }
};

const common = { bundle: true, minify: !watch, sourcemap: watch ? 'inline' : false, loader: { '.json': 'json' }, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning' };
const appOpts = { ...common, entryPoints: { main: join(root, 'src/main.js'), ...(existsSync(join(root, 'src/sat/worker.js')) ? { satworker: join(root, 'src/sat/worker.js') } : {}) }, outdir: join(dist, 'assets'), format: 'esm', plugins: [satShim, page] };

if (v1) {
  await esbuild.build({ ...common, entryPoints: [join(root, 'archive/v1/main.js')], format: 'iife', write: false, plugins: [inlineV1] });
} else if (watch) {
  const ctx = await esbuild.context(appOpts);
  await ctx.watch();
  if (process.argv.includes('--serve')) { const { serve } = await import('./serve.mjs'); await serve(5173); console.log('watching src/ … refresh the browser after each save'); }
  else console.log('watching src/ …');
} else {
  await esbuild.build(appOpts);
}

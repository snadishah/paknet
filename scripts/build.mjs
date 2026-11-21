// Bundles src/main.js (three.js + data) with esbuild and inlines it into
// src/template.html, producing one self-contained dist/index.html.
//   npm run build        -> one-off build
//   npm run dev          -> rebuild on every save (refresh the browser)
//   npm run build:v1     -> build the archived neon v1 into dist/v1.html
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const v1 = process.argv.includes('--v1');
const watch = process.argv.includes('--watch');
const entry = join(root, v1 ? 'archive/v1/main.js' : 'src/main.js');
const template = join(root, v1 ? 'archive/v1/template.html' : 'src/template.html');
const out = join(root, 'dist', v1 ? 'v1.html' : 'index.html');

const inline = {
  name: 'inline-into-html',
  setup(build) {
    build.onEnd(result => {
      if (result.errors.length) return;
      const js = result.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
      const html = readFileSync(template, 'utf8').replace('<script>/*BUNDLE*/</script>', () => `<script>${js}</script>`);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, html);
      console.log(`built ${out} (${(html.length / 1024).toFixed(0)} KB)`);
    });
  }
};

const opts = {
  entryPoints: [entry], bundle: true, minify: !watch, format: 'iife', write: false,
  loader: { '.json': 'json' }, define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [inline], logLevel: 'warning'
};

if (watch) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  console.log('watching src/ … open dist/index.html and refresh after each save');
} else {
  await esbuild.build(opts);
}

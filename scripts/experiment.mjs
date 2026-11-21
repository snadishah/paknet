// Bundle scripts/experiments.js with esbuild (it imports the app's modules,
// which import JSON) and run it in Node.   npm run experiment
import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = join(root, 'node_modules', '.cache', 'paknet-experiments.mjs');
mkdirSync(dirname(outfile), { recursive: true });
await esbuild.build({ entryPoints: [join(root, 'scripts/experiments.js')], bundle: true, platform: 'node', format: 'esm', outfile, loader: { '.json': 'json' }, logLevel: 'warning' });
process.chdir(root);
await import(pathToFileURL(outfile).href);

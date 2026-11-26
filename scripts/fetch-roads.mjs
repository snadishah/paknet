// Bundle scripts/roads.js with esbuild (it imports the app's topology, which
// imports JSON) and run it in Node.   npm run roads
import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = join(root, 'node_modules', '.cache', 'paknet-roads.mjs');
mkdirSync(dirname(outfile), { recursive: true });
await esbuild.build({ entryPoints: [join(root, 'scripts/roads.js')], bundle: true, platform: 'node', format: 'esm', outfile, loader: { '.json': 'json' }, logLevel: 'warning', external: ['three'] });
process.chdir(root);
await import(pathToFileURL(outfile).href);

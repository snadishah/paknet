// Tiny static server for dist/ with no dependencies.
//   node scripts/serve.mjs [port]
// Used by `npm run dev` (together with the watcher in build.mjs) and by the
// Claude preview pane (.claude/launch.json).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(repo, 'dist');
// /prototype/... is served from the repo's prototype/ folder (design mockups).
const protoRoot = join(repo, 'prototype');
const port = +(process.argv.slice(2).find(a => /^\d+$/.test(a)) || process.env.PORT || 5173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.map': 'application/json' };

export function serve(p0 = port, quiet = false) {
  const srv = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const proto = p.startsWith('/prototype/');
    const base = proto ? protoRoot : root;
    const file = normalize(join(base, proto ? p.slice('/prototype'.length) : p));
    if (file !== base && !file.startsWith(base + sep)) { res.writeHead(403); return res.end(); }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  return new Promise(res => srv.listen(p0, () => { if (!quiet) console.log(`serving dist/ on http://localhost:${p0}`); res(srv); }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) serve();

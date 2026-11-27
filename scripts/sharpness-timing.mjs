// How long after a flight lands until the satellite imagery is sharp (no tiles loading), with and without
// loading the destination's tiles during the flight. Needs `npm run preview` running on port 4173.
//   node scripts/sharpness-timing.mjs
import { chromium } from 'playwright';

const PLACES = [[27.70, 68.86], [32.49, 74.53], [29.39, 71.68], [25.39, 68.37], [31.27, 72.31], [33.99, 72.93]];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:4173/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__paknetReady, null, { timeout: 60000 });
const out = await page.evaluate(async places => {
  window.__paknet.ctx.shell.start(true);
  const ts = window.__paknet.debug.tileState, sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (cond, max) => { const t0 = performance.now(); while (!cond() && performance.now() - t0 < max) await sleep(50); return Math.round(performance.now() - t0); };
  const home = { lat: 30, lon: 69, range: 2600, heading: 0, tilt: 0 }, res = [];
  await window.__flyTo(home, 1500); await sleep(3000);
  for (let i = 0; i < places.length; i++) {
    ts.noPrefetch = i % 2 === 1; // alternate: with, without
    await window.__flyTo({ lat: places[i][0], lon: places[i][1], range: 3, heading: 0, tilt: 50 }, 3000);
    res.push({ at: places[i].join(','), prefetch: !ts.noPrefetch, sharpAfterLandingMs: await until(() => !ts.busy, 40000) });
    await window.__flyTo(home, 1500); await sleep(2500);
  }
  return res;
}, PLACES);
await browser.close();
const avg = on => Math.round(out.filter(r => r.prefetch === on).reduce((a, r) => a + r.sharpAfterLandingMs, 0) / out.filter(r => r.prefetch === on).length);
console.log(out.map(r => `${r.at}  prefetch=${r.prefetch}  ${r.sharpAfterLandingMs} ms`).join('\n'));
console.log(`average: with ${avg(true)} ms, without ${avg(false)} ms`);

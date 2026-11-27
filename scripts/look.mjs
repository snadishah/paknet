// Quick screenshots of any views, headless (needs `npm run preview` on port 4173).
//   node scripts/look.mjs office=24.8495,67.0105,0.25,200,60 [paksat=0,38.2,3000,15,12,35786] [--hour=9] [--phone]
// Each view is name=lat,lon,range,heading,tilt[,alt]; images go to .verify/look-<name>.png.
// --hour=H sets the simulated Pakistan time (daylight checks); --wait=ms how long to let it load (default 9000).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2), opt = k => args.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const views = args.filter(a => !a.startsWith('--')).map(a => { const [name, v] = a.split('='); const [lat, lon, range, heading = 0, tilt = 0, alt = 0] = v.split(',').map(Number); return { name, pose: { lat, lon, range, heading, tilt, alt } }; });
const phone = args.includes('--phone'), hour = opt('hour'), wait = +(opt('wait') || 9000);
mkdirSync('.verify', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const utc = hour != null ? `#t=2026-11-27T${String((+hour + 19) % 24).padStart(2, '0')}:00:00` : ''; // Pakistan time is UTC+5
await page.goto('http://localhost:4173/' + utc, { waitUntil: 'load' });
await page.waitForFunction(() => window.__paknetReady, null, { timeout: 60000 });
await page.evaluate(() => window.__paknet.ctx.shell.start(true));
for (const { name, pose } of views) {
  await page.evaluate(p => window.__flyTo(p, 10), pose);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `.verify/look-${name}.png` });
  console.log(`.verify/look-${name}.png`, await page.evaluate(() => `draw calls ${window.__paknet.debug.renderer.info.render.calls}`));
}
if (errors.length) console.log('errors:', errors.slice(0, 5).join(' | '));
await browser.close();

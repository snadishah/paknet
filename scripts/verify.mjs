// End-of-phase check: build, serve dist/, open it in headless Chromium at a
// MacBook and a phone size, take screenshots, record console errors and frame
// times, and write a short .verify/report.json. Prints a 10-line summary.
//   npm run verify              build + check
//   npm run verify -- --no-build
//   npm run verify -- --shots=karachi,sat-far   only these extra shots
// Headless Chromium renders WebGL in software (SwiftShader), so its frame times
// are a smoke test only; confirm smoothness with ?perf=1 in real Chrome.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.verify');
const args = process.argv.slice(2);
const onlyShots = (args.find(a => a.startsWith('--shots=')) || '').slice(8).split(',').filter(Boolean);
mkdirSync(out, { recursive: true });

// --no-keys: build without the imagery keys, to check the keyless fallbacks (EOX → NASA)
if (!args.includes('--no-build')) execFileSync(process.execPath, [join(root, 'scripts/build.mjs')], { stdio: 'pipe', env: { ...process.env, ...(args.includes('--no-keys') ? { PAKNET_NO_KEYS: '1' } : {}) } });

function dirSize(d) { let s = 0; for (const f of readdirSync(d)) { const p = join(d, f); const st = statSync(p); s += st.isDirectory() ? dirSize(p) : st.size; } return s; }
const distMB = +(dirSize(join(root, 'dist')) / 1048576).toFixed(2);

const PORT = 4180;
const server = await serve(PORT, true);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const VIEWPORTS = [{ name: 'mac', width: 1440, height: 900, frames: true }, { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true }];
const report = { when: new Date().toISOString(), distMB, checks: {}, views: {} };
// Warm-up: one throw-away load so the first measurement isn't a cold browser start
// (shader compiler and HTTP caches empty), which no real visitor sees twice.
{ const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
  await p.goto(`http://localhost:${PORT}/?verify=1`, { waitUntil: 'commit', timeout: 60000 }).catch(() => {});
  await p.waitForFunction(() => window.__paknetReady === true, null, { timeout: 45000 }).catch(() => {}); await ctx.close(); }
const pct = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); };

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
  const page = await ctx.newPage();
  const errors = [], warnings = [];
  // optional internet resources (close-up tiles, web font, live orbits) may fail offline: counted, not errors
  const OPTIONAL = /tiles\.maps\.eox\.at|arcgis\.com|api\.maptiler\.com|fonts\.(googleapis|gstatic)\.com|celestrak/;
  // never write an API key anywhere: strip token= / key= values from every logged URL or message
  const redact = t => String(t).replace(/([?&](token|key)=)[^&\s'"]+/gi, '$1<redacted>');
  const netSoft = [];
  page.on('console', m => { const t = m.type(), url = m.location()?.url || ''; if (t === 'error' && OPTIONAL.test(url)) netSoft.push(redact(url)); else if (t === 'error') errors.push(redact(m.text())); else if (t === 'warning') warnings.push(redact(m.text())); });
  page.on('pageerror', e => errors.push('pageerror: ' + redact(e.message)));
  page.on('requestfailed', r => { if (OPTIONAL.test(r.url())) netSoft.push(redact(r.url())); else errors.push('requestfailed: ' + redact(r.url())); });
  const v = { errors, warnings, shots: [], netSoft };
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/?verify=1`, { waitUntil: 'commit', timeout: 60000 });
  try { await page.waitForFunction(() => window.__paknetReady === true, null, { timeout: 45000 }); v.readyMs = Date.now() - t0; }
  catch { v.readyMs = null; errors.push('window.__paknetReady never became true'); }
  v.timing = await page.evaluate(() => ({ ...window.__paknetTiming, nav: Math.round(performance.now()) })).catch(() => null);
  await page.waitForTimeout(1500);
  const shot = async (name) => { const f = `${vp.name}-${name}.png`; await page.screenshot({ path: join(out, f) }); v.shots.push(f); };
  await shot('first-screen');

  if (vp.frames && v.readyMs != null) {
    // 10 s of frame times on the first screen (rAF deltas), plus renderer stats
    v.frames = await page.evaluate(() => new Promise(res => {
      const d = []; let last = performance.now(); const end = last + 10000;
      const f = (t) => { d.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else res(d); };
      requestAnimationFrame(f);
    }));
    v.p50 = pct(v.frames, 0.5); v.p95 = pct(v.frames, 0.95); v.maxFrame = +Math.max(...v.frames).toFixed(1); v.frames = v.frames.length;
  }

  // Continuous zoom from space to 300 m over Karachi: no black frame, no big jump.
  if (vp.frames && v.readyMs != null) {
    const z = await page.evaluate(() => window.__paknet?.zoomTest?.(150)).catch(e => (errors.push('zoomTest: ' + e.message), null));
    v.imagery = await page.evaluate(() => window.__paknet.debug.tileState.provider).catch(() => null);
    v.zoomDetail = await page.evaluate(() => window.__paknet.zoomDetail).catch(() => null);
    v.debugText = await page.evaluate(() => /\bfps\b|frame ms|draw calls|triangles/i.test(document.body.innerText)).catch(() => null);
    // a black frame = a frame much darker than both neighbours (absolute brightness depends on day or night)
    if (z) { v.zoomMinLuma = Math.min(...z.slice(1, -1).map((x, i) => x / Math.max(1, Math.min(z[i], z[i + 2])))); v.zoomLuma = z; const zz = z.slice(6); /* the first steps are the globe growing from 27,000 km: smooth but fast */ v.zoomMaxJump = +Math.max(...zz.slice(2).map((x, i) => Math.abs(x - 2 * zz[i + 1] + zz[i]) / Math.max(40, zz[i + 1]))).toFixed(2); } // floor 40/255: smaller changes in a dark scene aren't visible // sudden spikes, not steady change
  }
  // City view memory: geometries come back to the baseline after leaving the city
  if (vp.frames && v.readyMs != null) {
    const m = await page.evaluate(() => window.__paknet?.cityMemoryTest?.()).catch(e => (errors.push('cityMemoryTest: ' + e.message), null));
    if (m) { v.cityMem = m; v.cityDisposed = m.inside.city && !m.after.city && m.after.geometries <= m.before.geometries + 2; } // loaded inside, gone after, no leak
  }
  // Every scenario plays to the end without errors
  if (vp.frames && v.readyMs != null) {
    const sm = await page.evaluate(() => window.__paknet?.scenarioSmoke?.()).catch(e => (errors.push('scenarioSmoke: ' + e.message), null));
    if (sm) { v.scenarios = sm; v.scenariosOk = Object.values(sm).every(r => r.learned && !r.error); }
  }
  // Extra shots the app offers (window.__paknet.shots: name → async setup)
  const names = await page.evaluate(() => Object.keys(window.__paknet?.shots || {})).catch(() => []);
  for (const n of names) {
    if (onlyShots.length && !onlyShots.includes(n)) continue;
    if (vp.name === 'phone' && !/first|start|tour|traceroute|karachi/.test(n)) continue;
    try {
      await page.evaluate(n => window.__paknet.shots[n](), n);
      await page.waitForTimeout(800);
      await shot(n);
      (v.shotCalls ||= {})[n] = await page.evaluate(() => window.__paknetStats.calls).catch(() => null); // draw calls in this view
    } catch (e) { errors.push(`shot ${n}: ${e.message.split('\n')[0]}`); }
  }
  const stats = await page.evaluate(() => window.__paknetStats ? { ...window.__paknetStats } : null).catch(() => null);
  if (stats) { v.drawCalls = stats.calls; v.maxDrawCalls = stats.maxCalls; v.maxDrawCallsAt = stats.maxAt; v.maxDrawCallsWhat = stats.maxWhat; v.triangles = stats.triangles; v.textures = stats.textures; }
  report.views[vp.name] = v;
  await ctx.close();
}
await browser.close(); server.close();

const mac = report.views.mac, phone = report.views.phone;
report.checks = {
  ready: !!(mac.readyMs != null && phone.readyMs != null),
  firstScreenUnder3s: mac.readyMs != null && mac.readyMs < 3000,
  noConsoleErrors: mac.errors.length + phone.errors.length === 0,
  drawCallsUnder150: mac.maxDrawCalls == null ? null : mac.maxDrawCalls <= 150, // round 2 budget: about 150
  assetsUnder25MB: distMB <= 25,
  p95Under20ms_smoke: mac.p95 == null ? null : mac.p95 <= 20,
  cityMemoryReturns: mac.cityDisposed ?? null,
  noDebugTextOnScreen: mac.debugText == null ? null : !mac.debugText,
  scenariosEndToEnd: mac.scenariosOk ?? null,
  zoomNoBlackFrame: mac.zoomMinLuma == null ? null : mac.zoomMinLuma > 0.6,
  zoomNoPop: mac.zoomMaxJump == null ? null : mac.zoomMaxJump < 0.15
};
for (const v of Object.values(report.views)) { v.optionalNetFailures = v.netSoft.length; delete v.netSoft; v.errorCount = v.errors.length; v.errors = v.errors.slice(0, 8); v.warnings = v.warnings.slice(0, 5); }
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));

const ok = b => (b === null ? 'n/a' : b ? 'PASS' : 'FAIL');
const lines = [
  `verify ${report.when}`,
  `dist size: ${distMB} MB  (≤ 25 MB: ${ok(report.checks.assetsUnder25MB)})`,
  `ready: mac ${mac.readyMs ?? '—'} ms, phone ${phone.readyMs ?? '—'} ms  (< 3 s: ${ok(report.checks.firstScreenUnder3s)})`,
  `frames (headless, smoke): ${mac.frames ?? 0} frames, p50 ${mac.p50 ?? '—'} ms, p95 ${mac.p95 ?? '—'} ms, max ${mac.maxFrame ?? '—'} ms`,
  `draw calls: now ${mac.drawCalls ?? '—'}, max seen ${mac.maxDrawCalls ?? '—'} (≤ 150: ${ok(report.checks.drawCallsUnder150)}); triangles ${mac.triangles ?? '—'}; textures ${mac.textures ?? '—'}`,
  `console errors: mac ${mac.errorCount}, phone ${phone.errorCount}  (${ok(report.checks.noConsoleErrors)}); optional internet requests failed: ${mac.optionalNetFailures + phone.optionalNetFailures}`,
  `first error: ${(mac.errors[0] || phone.errors[0] || 'none').slice(0, 140)}`,
  `zoom space→300 m: darkest frame vs neighbours ${mac.zoomMinLuma != null ? mac.zoomMinLuma.toFixed(2) : '—'} (${ok(report.checks.zoomNoBlackFrame)}), biggest sudden change ${mac.zoomMaxJump ?? '—'} (${ok(report.checks.zoomNoPop)}); warnings ${mac.warnings.length}`,
  `city memory (geometries before/inside/after): ${mac.cityMem ? [mac.cityMem.before.geometries, mac.cityMem.inside.geometries, mac.cityMem.after.geometries].join(' / ') : '—'} (${ok(report.checks.cityMemoryReturns)})`,
  `scenarios end to end: ${mac.scenarios ? Object.values(mac.scenarios).filter(r => r.learned && !r.error).length + '/' + Object.keys(mac.scenarios).length : '—'} (${ok(report.checks.scenariosEndToEnd)})`,
  `imagery provider seen: ${mac.imagery ?? '—'}; debug text on screen: ${mac.debugText ? 'YES' : 'none'}`,
  `screenshots: ${mac.shots.length + phone.shots.length} in .verify/ (${[...mac.shots, ...phone.shots].slice(0, 6).join(', ')}${mac.shots.length + phone.shots.length > 6 ? ', …' : ''})`,
  `overall: ${Object.entries(report.checks).every(([k, c]) => c !== false || k.endsWith('_smoke')) ? 'PASS' : 'FAIL'}  (details: .verify/report.json)`
];
console.log(lines.join('\n'));

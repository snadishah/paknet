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

if (!args.includes('--no-build')) execFileSync(process.execPath, [join(root, 'scripts/build.mjs')], { stdio: 'pipe' });

function dirSize(d) { let s = 0; for (const f of readdirSync(d)) { const p = join(d, f); const st = statSync(p); s += st.isDirectory() ? dirSize(p) : st.size; } return s; }
const distMB = +(dirSize(join(root, 'dist')) / 1048576).toFixed(2);

const PORT = 4180;
const server = await serve(PORT, true);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const VIEWPORTS = [{ name: 'mac', width: 1440, height: 900, frames: true }, { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true }];
const report = { when: new Date().toISOString(), distMB, checks: {}, views: {} };
const pct = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); };

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
  const page = await ctx.newPage();
  const errors = [], warnings = [];
  page.on('console', m => { const t = m.type(); if (t === 'error') errors.push(m.text()); else if (t === 'warning') warnings.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => { if (!/tiles\.maps\.eox\.at|celestrak/.test(r.url())) errors.push('requestfailed: ' + r.url()); });
  const v = { errors, warnings, shots: [] };
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
    if (z) { v.zoomMinLuma = Math.min(...z.slice(6)); v.zoomLuma = z; v.zoomMaxJump = +Math.max(...z.slice(2).map((x, i) => Math.abs(x - 2 * z[i + 1] + z[i]) / Math.max(20, z[i + 1]))).toFixed(2); } // sudden spikes, not steady change
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
    } catch (e) { errors.push(`shot ${n}: ${e.message.split('\n')[0]}`); }
  }
  const stats = await page.evaluate(() => window.__paknetStats ? { ...window.__paknetStats } : null).catch(() => null);
  if (stats) { v.drawCalls = stats.calls; v.maxDrawCalls = stats.maxCalls; v.triangles = stats.triangles; v.textures = stats.textures; }
  report.views[vp.name] = v;
  await ctx.close();
}
await browser.close(); server.close();

const mac = report.views.mac, phone = report.views.phone;
report.checks = {
  ready: !!(mac.readyMs != null && phone.readyMs != null),
  firstScreenUnder3s: mac.readyMs != null && mac.readyMs < 3000,
  noConsoleErrors: mac.errors.length + phone.errors.length === 0,
  drawCallsUnder100: mac.maxDrawCalls == null ? null : mac.maxDrawCalls <= 100,
  assetsUnder25MB: distMB <= 25,
  p95Under20ms_smoke: mac.p95 == null ? null : mac.p95 <= 20,
  zoomNoBlackFrame: mac.zoomMinLuma == null ? null : mac.zoomMinLuma > 20,
  zoomNoPop: mac.zoomMaxJump == null ? null : mac.zoomMaxJump < 0.15
};
for (const v of Object.values(report.views)) { v.errorCount = v.errors.length; v.errors = v.errors.slice(0, 8); v.warnings = v.warnings.slice(0, 5); }
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));

const ok = b => (b === null ? 'n/a' : b ? 'PASS' : 'FAIL');
const lines = [
  `verify ${report.when}`,
  `dist size: ${distMB} MB  (≤ 25 MB: ${ok(report.checks.assetsUnder25MB)})`,
  `ready: mac ${mac.readyMs ?? '—'} ms, phone ${phone.readyMs ?? '—'} ms  (< 3 s: ${ok(report.checks.firstScreenUnder3s)})`,
  `frames (headless, smoke): ${mac.frames ?? 0} frames, p50 ${mac.p50 ?? '—'} ms, p95 ${mac.p95 ?? '—'} ms, max ${mac.maxFrame ?? '—'} ms`,
  `draw calls: now ${mac.drawCalls ?? '—'}, max seen ${mac.maxDrawCalls ?? '—'} (≤ 100: ${ok(report.checks.drawCallsUnder100)}); triangles ${mac.triangles ?? '—'}; textures ${mac.textures ?? '—'}`,
  `console errors: mac ${mac.errorCount}, phone ${phone.errorCount}  (${ok(report.checks.noConsoleErrors)})`,
  `first error: ${(mac.errors[0] || phone.errors[0] || 'none').slice(0, 140)}`,
  `zoom space→300 m: min brightness ${mac.zoomMinLuma ?? '—'} (${ok(report.checks.zoomNoBlackFrame)}), biggest sudden change ${mac.zoomMaxJump ?? '—'} (${ok(report.checks.zoomNoPop)}); warnings ${mac.warnings.length}`,
  `screenshots: ${mac.shots.length + phone.shots.length} in .verify/ (${[...mac.shots, ...phone.shots].slice(0, 6).join(', ')}${mac.shots.length + phone.shots.length > 6 ? ', …' : ''})`,
  `overall: ${Object.entries(report.checks).every(([k, c]) => c !== false || k.endsWith('_smoke')) ? 'PASS' : 'FAIL'}  (details: .verify/report.json)`
];
console.log(lines.join('\n'));

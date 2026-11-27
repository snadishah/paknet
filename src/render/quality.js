// Dynamic quality fallback (docs/REDESIGN.md §6): if the 95th-percentile frame
// time stays above 25 ms for 3 seconds, step down once, then again if needed:
//   level 1: pixel ratio 1
//   level 2: also a smaller satellite sample (every 3rd "coming soon" satellite)
// (The globe has no separate cloud layer: clouds are part of the day image.)
// When frames run at full speed again for 12 s (a slow spell while loading, say), it steps back up,
// at most twice per visit, so the picture never flickers between levels.
import { setPixelRatio, quality } from './scene.js';
import { setSatSample, satUniforms } from './satellites.js';
import { setFxPixelRatio } from './fx.js';
import { packetUniforms } from './packets.js';
import { glyphUniforms } from './network.js';
import { renderer } from './scene.js';

const WINDOW = 90, LIMIT_MS = 25, HOLD_MS = 4000, FAST_MS = 18, RECOVER_MS = 12000;
const times = new Float32Array(WINDOW), sorted = new Float32Array(WINDOW); let n = 0, slowSince = 0, fastSince = 0, ups = 0;
export const qualityState = { level: 0, p95: 0 };

export function watchFrame(ms, now = performance.now()) {
  if (ms > 1000 || now < 8000) return; // a tab switch or a pause, or the page still loading: not a slow frame
  times[n++ % WINDOW] = ms;
  if (n < WINDOW || n % 15) return; // check four times a second
  sorted.set(times); sorted.sort(); qualityState.p95 = sorted[Math.floor(0.95 * WINDOW)]; // typed-array sort is numeric, no allocation
  if (qualityState.p95 > LIMIT_MS) { fastSince = 0; if (!slowSince) slowSince = now; if (now - slowSince > HOLD_MS && qualityState.level < 2) { stepDown(); slowSince = 0; n = 0; } }
  else {
    slowSince = 0;
    if (qualityState.p95 < FAST_MS && qualityState.level > 0 && ups < 2) { if (!fastSince) fastSince = now; if (now - fastSince > RECOVER_MS) { stepUp(); fastSince = 0; n = 0; } }
    else fastSince = 0;
  }
}
function stepUp() {
  ups++; qualityState.level--;
  if (qualityState.level === 1) setSatSample(1);
  if (qualityState.level === 0 && quality.full > 1) setPixelRatio(quality.full);
  packetUniforms.uPR.value = glyphUniforms.uPR.value = satUniforms.uPR.value = renderer.getPixelRatio(); setFxPixelRatio(renderer.getPixelRatio());
}

function stepDown() {
  qualityState.level++;
  if (qualityState.level === 1 && quality.pixelRatio > 1) { quality.full = quality.pixelRatio; setPixelRatio(1); }
  if (qualityState.level === 2) setSatSample(3);
  packetUniforms.uPR.value = glyphUniforms.uPR.value = satUniforms.uPR.value = renderer.getPixelRatio(); setFxPixelRatio(renderer.getPixelRatio());
}

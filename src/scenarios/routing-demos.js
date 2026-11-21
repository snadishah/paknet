// Routing demos. Count-to-infinity is STILL SCRIPTED; step 4 of docs/PLAN.md
// replaces it with a real distance-vector protocol.
import { buildPath, reversePath } from '../routing/paths.js';
import { ui, setTab } from '../ui/dom.js';

export function createRoutingDemos(ctx) {
  const { G, net, traffic, flyTo } = ctx;
  const { N, adj } = G;
  let loopTimer = null;

  function countToInfinity() {
    setTab('route'); const A = N('Sibi'), B = N('Jacobabad'), X = N('Quetta');
    const e = adj.get(A.id).find(e => e.a === X.id || e.b === X.id); if (!e || e.cut) return;
    net.cutEdge(e); net.topologyChanged([e], 'RIP'); flyTo('cti');
    const box = ui('cti'); box.innerHTML = ''; let k = 0;
    const p1 = buildPath(A.id, [adj.get(A.id).find(x => x.a === B.id || x.b === B.id)]), p2 = reversePath(p1);
    clearInterval(loopTimer);
    loopTimer = setInterval(() => {
      k++; const da = 1 + 2 * k, db = 2 + 2 * k;
      box.innerHTML = `<div class="ctirow"><span>Round ${k}</span><span>Sibi → Quetta <b>${da >= 16 ? '∞' : da}</b></span><span>Jacobabad → Quetta <b>${db >= 16 ? '∞' : db}</b></span></div>` + box.innerHTML;
      traffic.emitPacket(k % 2 ? p1 : p2, 'loop', { speed: 1.5, size: 0.12 }); traffic.emitPacket(k % 2 ? p2 : p1, 'loop', { speed: 1.5, size: 0.12 });
      if (da >= 16) { clearInterval(loopTimer); box.innerHTML = `<div class="ctirow done">Hit 16 (= infinity), route withdrawn. Split horizon or poison reverse prevents this.</div>` + box.innerHTML; }
    }, 650);
  }

  return { countToInfinity };
}

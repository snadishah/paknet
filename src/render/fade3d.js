// Scene objects fade instead of popping (Quality Bar): in when they appear, out before they go.
// Works on every material that has an opacity (lines, meshes); each material's own opacity is
// remembered as its full value. updateFades(dt) runs once a frame.
const jobs = new Map(); // material → { from, to, t, d, done }
const groupsDone = new Set();

const matsOf = o => { const m = []; o.traverse(x => { if (x.material) for (const mm of [].concat(x.material)) if ('opacity' in mm) m.push(mm); }); return m; };
const full = m => (m.userData.full ??= m.opacity);

function tween(m, to, ms) { m.transparent = true; jobs.set(m, { from: m.opacity, to, t: 0, d: Math.max(1, ms) }); }

// Fade o in from nothing to its materials' own opacity.
export function fadeIn(o, ms = 300) { for (const m of matsOf(o)) { const f = full(m); m.opacity = 0; tween(m, f, ms); } return o; }
// Fade o out, then call done (e.g. remove and dispose it).
export function fadeOut(o, ms = 300, done = null) {
  const ms_ = matsOf(o); for (const m of ms_) { full(m); tween(m, 0, ms); }
  if (done) groupsDone.add({ t: 0, d: ms, done });
}
// Show or hide a layer (a group) with a fade; it is only made invisible once faded out.
export function showLayer(g, on, ms = 400) {
  if (on) { if (!g.visible) { g.visible = true; for (const m of matsOf(g)) { full(m); m.opacity = 0; } } for (const m of matsOf(g)) tween(m, full(m), ms); g.userData.hiding = false; }
  else if (g.visible) { g.userData.hiding = true; fadeOut(g, ms, () => { if (g.userData.hiding) g.visible = false; }); }
}
// Change a material's resting opacity smoothly (e.g. dimming the backbone under the heat map).
export function fadeOpacity(m, to, ms = 400) { m.userData.full = to; tween(m, to, ms); }

const ease = k => k * k * (3 - 2 * k);
export function updateFades(dt) {
  const ms = dt * 1000;
  for (const [m, j] of jobs) { j.t += ms; const k = Math.min(1, j.t / j.d); m.opacity = j.from + (j.to - j.from) * ease(k); if (k >= 1) jobs.delete(m); }
  for (const g of groupsDone) { g.t += ms; if (g.t >= g.d) { groupsDone.delete(g); g.done(); } }
}

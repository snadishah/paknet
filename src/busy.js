// Things loading in the background (imagery, buildings, textures, data). The shell shows a
// small spinner with the first label while anything is pending, so the user always knows.
const jobs = new Map(); // label → number pending

export function busyBegin(label) {
  jobs.set(label, (jobs.get(label) || 0) + 1);
  let done = false;
  return () => { if (done) return; done = true; const n = jobs.get(label) - 1; if (n > 0) jobs.set(label, n); else jobs.delete(label); };
}
export const busyLabel = () => jobs.keys().next().value || null;

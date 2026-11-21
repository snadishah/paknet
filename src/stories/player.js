// Story player: which story and beat are showing, and moving between beats.
// Going forward runs the next beat's action on the live simulation. Going back
// resets the world and replays the earlier beats' actions instantly (fast), so
// the network is exactly as the story left it at that point.
import { emit } from '../events.js';
import { state } from '../state.js';

export function createStoryPlayer(kit) {
  let story = null, index = -1, auto = null, savedDefence = null;

  function start(s) {
    exit(true);
    savedDefence = state.defense;
    story = s; index = -1;
    kit.reset(); s.setup?.(kit);
    emit('story:start', { story });
    go(0);
  }

  function go(k) {
    if (!story) return;
    k = Math.max(0, Math.min(story.beats.length - 1, k));
    if (k <= index) { kit.reset(); story.setup?.(kit); for (let i = 0; i < k; i++) story.beats[i].enter?.(kit, true); }
    else for (let i = index + 1; i < k; i++) story.beats[i].enter?.(kit, true);
    index = k;
    story.beats[k].enter?.(kit, false);
    emit('story:beat', { story, index, beat: story.beats[k] });
  }

  const next = () => { if (story && index < story.beats.length - 1) go(index + 1); else stopAuto(); };
  const prev = () => go(index - 1);

  function toggleAuto() { if (auto) stopAuto(); else { auto = setInterval(next, 9000); emit('story:auto', true); } }
  function stopAuto() { if (auto) { clearInterval(auto); auto = null; emit('story:auto', false); } }

  // Leave the story and put the network back as it was.
  function exit(silent = false) {
    stopAuto();
    if (!story) return;
    story = null; index = -1; kit.reset();
    if (savedDefence != null) kit.setDefence(savedDefence);
    if (!silent) emit('story:exit');
  }

  return { start, go, next, prev, exit, toggleAuto, get story() { return story; }, get index() { return index; }, get auto() { return !!auto; } };
}

// Story mode UI. Desktop: the side panel becomes a narrative column (beat on
// top, chapters below). Phone: a lower third with a dated timeline.
// Beats can pin callouts to places and move the camera; live widgets refresh
// from the simulation while a beat is showing.
import { on } from '../events.js';
import { ui, setTab } from './dom.js';
import { STORIES } from '../stories/library.js';
import { createKit } from '../stories/kit.js';
import { createStoryPlayer } from '../stories/player.js';
import { addCallout, clearCallouts } from '../render/labels.js';
import { NET } from '../geo/projection.js';

export function initStories(ctx) {
  const kit = createKit(ctx), player = createStoryPlayer(kit);
  const { G, flyTo, failures, security } = ctx;
  const place = name => G.N(name) || G.nodes.find(n => n.name === name);

  // the library, in the Overview tab
  ui('storyList').innerHTML = STORIES.map(s => `<button class="action ${s.tone}" data-story="${s.id}"><span class="ic"><svg class="ico"><use href="#i-${s.icon}"/></svg></span><div><b>${s.title}</b><small>${s.date} · ${s.blurb}</small></div><svg class="ico go"><use href="#i-next"/></svg></button>`).join('');
  ui('storyList').querySelectorAll('[data-story]').forEach(b => b.onclick = () => player.start(STORIES.find(s => s.id === b.dataset.story)));

  let liveTimer = null;
  function renderLive(beat) { ui('stLive').innerHTML = beat.live ? beat.live(kit) : ''; }

  on('story:start', () => { document.body.classList.add('story-mode'); setTab('story'); });
  on('story:beat', ({ story, index, beat }) => {
    setTab('story'); // scenario helpers may have switched tabs
    ui('panelTitle').textContent = `${story.title} · ${story.date}`;
    ui('stKicker').textContent = beat.kicker || `${index + 1} of ${story.beats.length}`;
    ui('stTitle').textContent = beat.title;
    ui('stText').innerHTML = beat.text;
    ui('stSrc').textContent = beat.source ? 'Source: ' + beat.source : '';
    ui('stChapters').innerHTML = story.beats.map((b, i) => `<li class="${i < index ? 'done' : i === index ? 'now' : ''}" data-i="${i}">${b.title}</li>`).join('');
    ui('stChapters').querySelectorAll('li').forEach(li => li.onclick = () => player.go(+li.dataset.i));
    ui('stTimeline').innerHTML = story.beats.map((b, i) => `<span class="${i < index ? 'done' : i === index ? 'now' : ''}"><i></i><b>${b.tick}</b></span>`).join('');
    ui('stPrev').disabled = index === 0;
    ui('stNext').textContent = index === story.beats.length - 1 ? 'Finish' : 'Next';
    clearCallouts();
    for (const [name, html] of beat.callouts || []) { const n = place(name); if (n) addCallout(n.pos.clone().setZ(NET), html); }
    if (beat.viewFocus) flyTo(kit.focus(...beat.viewFocus), 1800); else if (beat.view) flyTo(beat.view, 1800);
    renderLive(beat);
    clearInterval(liveTimer); liveTimer = setInterval(() => renderLive(beat), 600);
  });
  on('story:exit', () => { clearInterval(liveTimer); clearCallouts(); document.body.classList.remove('story-mode'); setTab('overview'); });
  on('story:auto', v => ui('stAuto').classList.toggle('on', v));

  ui('stNext').onclick = () => (player.index === player.story.beats.length - 1 ? player.exit() : player.next());
  ui('stPrev').onclick = player.prev;
  ui('stAuto').onclick = player.toggleAuto;
  ui('stExit').onclick = () => player.exit();
  addEventListener('keydown', e => {
    if (!player.story || e.target.closest?.('input, select, textarea')) return;
    if (e.key === 'ArrowRight') player.next(); else if (e.key === 'ArrowLeft') player.prev(); else if (e.key === 'Escape') player.exit();
  });
  // buttons inside a beat's live area
  ui('stLive').addEventListener('click', e => {
    const a = e.target.closest('[data-story-action]')?.dataset.storyAction; if (!a) return;
    player.exit();
    if (a === 'replayRov') { kit.setDefence(true); security.runHijack(); }
    if (a === 'gwadar') { setTab('failures'); failures.SCEN.gwadar(); }
  });
  ui('btnStories').onclick = () => { setTab('overview'); ui('storyList').scrollIntoView({ block: 'start', behavior: 'smooth' }); };

  return { player, kit };
}

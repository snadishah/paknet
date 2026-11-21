// The story library: structure, sources, and that BGP beats do what the text says.
import { describe, it, expect } from 'vitest';
import { STORIES } from '../src/stories/library.js';
import { createInterdomain } from '../src/sim/interdomain.js';

// A kit with the real inter-domain model and no-op hands for everything else.
function bgpKit() {
  const interdomain = createInterdomain();
  const noop = () => {};
  return {
    interdomain,
    hijackWorld: () => interdomain.startManual({ start: '18:47:45' }),
    fbWorld: () => interdomain.startManual({ start: '15:39:00' }),
    bgp: (offset, action, fast) => { interdomain.jumpTo(offset); if (action) interdomain.act(action); if (fast) interdomain.settle(); },
    cut: noop, restore: noop, setCableCapacity: noop, setDefence: noop, security: { runDDoS: noop, runMalware: noop, stop: noop }
  };
}
const replay = (story, upTo) => { const k = bgpKit(); story.setup?.(k); for (let i = 0; i <= upTo; i++) story.beats[i].enter?.(k, true); return k; };
const beat = (story, tick) => story.beats.findIndex(b => b.tick === tick);

describe('story library', () => {
  it('has the six chosen stories', () => {
    expect(STORIES.map(s => s.id)).toEqual(['yt2008', 'aae1', 'redsea', 'ddos', 'phones', 'fb2021']);
  });
  it('every beat has a timeline tick, a title and text; ticks are unique within a story', () => {
    for (const s of STORIES) {
      for (const b of s.beats) { expect(b.tick, s.id).toBeTruthy(); expect(b.title, s.id).toBeTruthy(); expect(b.text, s.id).toBeTruthy(); }
      expect(new Set(s.beats.map(b => b.tick)).size).toBe(s.beats.length);
    }
  });
  it('every beat names a source', () => {
    for (const s of STORIES) for (const b of s.beats) expect(b.source, `${s.id}: ${b.title}`).toBeTruthy();
  });
});

describe('story beats drive BGP as the text says', () => {
  const yt = STORIES.find(s => s.id === 'yt2008'), fb = STORIES.find(s => s.id === 'fb2021');
  it('2008: hijacked after PTCL announces; partly recovered at 20:07; fully at 20:18', () => {
    expect(replay(yt, beat(yt, '18:47')).interdomain.worldHijackedShare()).toBe(1);
    const at2007 = replay(yt, beat(yt, '20:07')).interdomain.worldHijackedShare();
    expect(at2007).toBeGreaterThan(0); expect(at2007).toBeLessThan(1);
    expect(replay(yt, beat(yt, '20:18')).interdomain.worldHijackedShare()).toBe(0);
  });
  it('2021: Facebook\'s DNS unreachable after the withdrawal, back at 21:00', () => {
    expect(replay(fb, beat(fb, 'Before')).interdomain.fbReachableShare()).toBe(1);
    expect(replay(fb, beat(fb, '15:40')).interdomain.fbReachableShare()).toBe(0);
    expect(replay(fb, beat(fb, '21:00')).interdomain.fbReachableShare()).toBe(1);
  });
});

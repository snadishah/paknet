// Every first-time caption: at most 25 words and a Grade 1–3 reading level
// (Flesch–Kincaid; words taught on screen count as one syllable).
import { describe, it, expect } from 'vitest';
import { TOUR, PRESENT, PRESENT_END, readingGrade, wordCount } from '../src/stories/captions.js';
import { KIDS } from '../src/stories/kids.js';

const all = [...TOUR, ...PRESENT, PRESENT_END].map(c => [c.id, c.text]);
const titles = []; // short headings: length only (a reading-level formula needs sentences)
for (const [id, k] of Object.entries(KIDS)) { for (const [part, t] of [['what', k.what], ['bad', k.bad], ['heal', k.heal], ['learn', k.learn]]) all.push([`${id}.${part}`, t]); titles.push([`${id}.title`, k.title]); }

describe('captions for a first-time visitor', () => {
  it('the tour has at most 8 steps', () => { expect(TOUR.length).toBeLessThanOrEqual(8); });
  for (const [id, text] of titles) it(`${id}: ≤ 8 words`, () => { expect(wordCount(text)).toBeLessThanOrEqual(8); });
  for (const [id, text] of all) {
    it(`${id}: ≤ 25 words, Grade ≤ 3`, () => {
      expect(wordCount(text)).toBeLessThanOrEqual(25);
      expect(readingGrade(text)).toBeLessThanOrEqual(3.0);
    });
  }
});

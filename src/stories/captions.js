// Every caption a first-time visitor reads: the first-run tour and the
// presentation. Pure data (no DOM), so tests can check length and reading level.
// Rule: ≤ 25 words, short sentences, Grade 1–3 words (tests/captions.test.js).

export const TOUR = [
  { id: 'earth', text: 'This is Earth. It is our home, seen from space.' },
  { id: 'pakistan', text: 'This is Pakistan. Lots of people here use the internet every day.' },
  { id: 'packets', text: 'The internet is like a big post office. Each message is cut into tiny parcels. We call them packets.' },
  { id: 'cables', text: 'Parcels travel on roads. Some roads are cables on land. Some are cables under the sea.' },
  { id: 'satellite', text: 'Some parcels go up to a satellite. Then they come back down.' },
  { id: 'routers', text: 'Routers are post offices. They read the address and pick the road.' },
  { id: 'office', text: "Let's follow parcels from an office in Karachi. Watch the white dots go." },
  { id: 'try', text: 'Now you try. Click an office to see where its parcels go.' }
];

export const PRESENT = [
  { id: 'space', text: "This is Earth. Pakistan's internet joins it to the whole world." },
  { id: 'pakistan', text: 'This is Pakistan. Cables join the cities. Each dot is a parcel of data.' },
  { id: 'office', text: 'We follow one office in Karachi. Each stop on the list is a router.' },
  { id: 'satellites', text: 'Far away, PakSat-MM1 helps places with no cables. The near ones are not allowed here yet.' }
  // scenario slides are added by the scenario module (Phase 5); the defence loop is last
];
export const PRESENT_END = { id: 'defence', text: 'Our guard watches, thinks, plans and acts. It learns, like a good guard.' };

// ---------- reading level (used by the tests) ----------
// Words we teach on screen (with a glossary tooltip) count as one syllable.
export const TAUGHT = ['internet', 'satellite', 'satellites', 'packets', 'packet', 'routers', 'router', 'pakistan', "pakistan's", 'karachi', 'paksat-mm1', 'parcels', 'parcel', 'office', 'cables', 'cable',
  'youtube', 'facebook', 'gwadar', 'qatar', 'china', 'website', 'websites', 'video', 'videos'];
export function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z'-]/g, ''); if (!w) return 0;
  if (TAUGHT.includes(w)) return 1;
  // common rule: drop silent endings (-e, -es, -ed after a consonant), then count vowel groups
  const m = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g); return Math.max(1, m ? m.length : 1);
}
export function readingGrade(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim()).length || 1;
  const words = text.split(/\s+/).filter(w => /[a-z]/i.test(w));
  const syl = words.reduce((s, w) => s + syllables(w), 0);
  return 0.39 * (words.length / sentences) + 11.8 * (syl / words.length) - 15.59; // Flesch–Kincaid grade
}
export const wordCount = text => text.split(/\s+/).filter(w => /[a-z0-9]/i.test(w)).length;

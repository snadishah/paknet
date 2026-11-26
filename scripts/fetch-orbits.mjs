// Fetches orbit data (CelesTrak GP, OMM JSON) for the satellites PAKNET shows
// and saves a snapshot to src/data/satellites.json with the fetch date.
//   npm run orbits
// Big constellations are sampled (≤ 300 evenly spaced) to keep the file small;
// the UI says "sample of N". If a request fails, the previous snapshot's group
// is kept. Orbital data: CelesTrak (https://celestrak.org).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'src/data/satellites.json');
const GP = q => `https://celestrak.org/NORAD/elements/gp.php?${q}&FORMAT=json`;
const SAMPLE = 300;
const KEEP = ['OBJECT_NAME', 'OBJECT_ID', 'EPOCH', 'MEAN_MOTION', 'ECCENTRICITY', 'INCLINATION', 'RA_OF_ASC_NODE', 'ARG_OF_PERICENTER', 'MEAN_ANOMALY', 'NORAD_CAT_ID', 'BSTAR', 'MEAN_MOTION_DOT', 'MEAN_MOTION_DDOT'];

// key: [queries, filter]
const GROUPS = {
  paksat: [['CATNR=59915', 'CATNR=37779']],
  eyes: [['NAME=PRSS', 'NAME=PRSC', 'NAME=PAKTES']],
  starlink: [['GROUP=starlink']],
  oneweb: [['GROUP=oneweb']],
  kuiper: [['GROUP=kuiper']],
  qianfan: [['GROUP=qianfan']],
  telesat: [['NAME=LIGHTSPEED']], // Telesat Lightspeed: none in orbit as of the last fetch
  gps: [['GROUP=gps-ops']],
  beidou: [['GROUP=beidou']]
};

const prev = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : { groups: {} };
// Rows are stored as arrays in the order of `fields` (half the size of repeated keys).
const snap = { fetched: new Date().toISOString(), source: 'CelesTrak GP data (OMM JSON), https://celestrak.org', fields: KEEP, groups: {} };

async function get(q) {
  const r = await fetch(GP(q), { headers: { 'user-agent': 'paknet-student-project (build-time snapshot)' } });
  const t = await r.text();
  if (/No GP data found/i.test(t)) return []; // nothing in orbit under that name
  if (!r.ok) throw new Error(`${r.status} ${q}`);
  return JSON.parse(t);
}

for (const [key, [queries]] of Object.entries(GROUPS)) {
  try {
    let all = []; for (const q of queries) all.push(...await get(q));
    const seen = new Set(); all = all.filter(s => !seen.has(s.NORAD_CAT_ID) && seen.add(s.NORAD_CAT_ID));
    all.sort((a, b) => a.NORAD_CAT_ID - b.NORAD_CAT_ID);
    const total = all.length;
    const pick = total > SAMPLE ? Array.from({ length: SAMPLE }, (_, i) => all[Math.floor(i * total / SAMPLE)]) : all;
    snap.groups[key] = { total, sampled: pick.length < total, sats: pick.map(s => KEEP.map(k => s[k])) };
    console.log(`${key.padEnd(9)} ${total} in orbit${pick.length < total ? `, kept a sample of ${pick.length}` : ''}`);
  } catch (e) {
    console.warn(`${key}: ${e.message} — keeping the previous snapshot`);
    if (prev.groups[key]) snap.groups[key] = { ...prev.groups[key], stale: true };
  }
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(snap));
console.log(`saved ${out} (${(JSON.stringify(snap).length / 1024).toFixed(0)} KB, fetched ${snap.fetched})`);

// Scenario explanations a grade-1 child understands: what happens, why it's
// bad, how the network heals, and one "What did we learn?" sentence.
// Pure data; checked by tests/captions.test.js (≤ 25 words, Grade ≤ 3 each).
// The facts behind each scenario are in docs/REFERENCES.md §5.
export const KIDS = {
  aae1: {
    title: 'A cable under the sea breaks (AAE-1, 2025)',
    what: 'A big cable under the sea broke near Qatar.',
    bad: 'The parcels on it had no road, so videos got slow.',
    heal: 'The routers sent the parcels to other cables. Those cables got busy, like a traffic jam.',
    learn: 'Lots of cables are good. When one breaks, the rest help.'
  },
  redsea: {
    title: 'Cables cut in the Red Sea (2025)',
    what: 'In the Red Sea, two cables broke. Later, one more broke.',
    bad: 'Each cut took away a road, and the other roads got full.',
    heal: 'The parcels took the cables that still worked. Ships came to fix the broken ones.',
    learn: 'Cables that go the same way can break at once. We need roads that go other ways too.'
  },
  kkh: {
    title: 'A landslide on the road to China',
    what: 'Rocks slid down a mountain and broke the cable to China.',
    bad: 'The radio towers on the hills had to carry the parcels. They are slower.',
    heal: 'Most parcels went south to the sea cables instead.',
    learn: 'A backup road helps, but it is slow and small.'
  },
  gwadar: {
    title: 'What if Gwadar had a cable? (imaginary)',
    what: 'This is a make-believe test. We add a new sea cable at Gwadar.',
    bad: 'Today all sea cables land in Karachi. One bad day there hurts us all.',
    heal: 'With Gwadar, parcels have a second door to the sea.',
    learn: 'Two doors are safer than one.'
  },
  ddos: {
    title: 'Too many visitors (DDoS)',
    what: 'Lots of fake visitors rush at one website at the same time.',
    bad: 'It is like a crowd blocking a shop door. Real people cannot get in.',
    heal: 'Our guard hears the alarm and sends the crowd to a filter. Real people get in again.',
    learn: 'A guard that watches all the time can stop a crowd fast.'
  },
  phones: {
    title: 'Phones that were tricked (botnet)',
    what: 'Bad apps take over some phones. The phones obey a bad person.',
    bad: 'They send small secret calls. Then they all rush at one place.',
    heal: 'Our guard spots the secret calls and blocks those phones.',
    learn: 'A sick phone calls out on a beat. That is how we spot it.'
  },
  hijack: {
    title: 'Someone changed the road signs (YouTube, 2008)',
    what: 'In 2008, a network in Pakistan put up a wrong road sign for YouTube.',
    bad: 'The sign spread over the world. Parcels for YouTube came to Pakistan and got lost.',
    heal: 'YouTube put up better signs, and the wrong one was taken down.',
    learn: 'Road signs need a stamp to show they are real. Then fake ones are not used.'
  },
  facebook: {
    title: 'Facebook vanished (2021)',
    what: 'In 2021, Facebook took down its own road signs by mistake.',
    bad: 'Parcels went round and round, then gave up. No one could find Facebook.',
    heal: 'Facebook workers put the signs back. It took about six hours.',
    learn: 'If your road signs go, no one can find you, even if you are fine.'
  },
  rip: {
    title: 'Two friends with wrong directions (RIP)',
    what: 'A road breaks. Two routers keep telling each other wrong directions.',
    bad: 'Each says the other is a step closer. The number grows: 3, 4, 5.',
    heal: 'At 16 they give up and say: no road. Then they stop the loop.',
    learn: 'Counting steps is simple, but slow to learn bad news.'
  },
  ospf: {
    title: 'News that spreads fast (OSPF)',
    what: 'A road breaks. The router next to it shouts the news.',
    bad: 'Routers that have not heard yet still send parcels to the broken road.',
    heal: 'The news jumps from router to router. Soon all of them pick new roads.',
    learn: 'When every router has the full map, news spreads fast.'
  }
};

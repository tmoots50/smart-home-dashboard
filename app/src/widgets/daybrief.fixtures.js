// State fixtures for the Morning Brief card. `date` resolves to "today" at
// module load (specs freeze page time BEFORE navigation, so this lands on
// tests/qa/clock.js FIXED_NOW); the harness mount pins "now" to 8:15a so the
// noon cutoff never hides a fixture.
//
// The states model Hermes's real output range: a full weekday, a quiet
// weekend, a nothing-to-report day (headline + closer only), and a
// worst-case verbose day (overflow). `empty` = no blob posted → card hidden.

import { getMockDaybrief } from '../lib/daybrief-mock.js';

function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const brief = (over) => ({
  date: todayYMD(),
  generatedAt: new Date().toISOString(),
  headline: '',
  sections: [],
  closer: null,
  ...over,
});

export const states = {
  // No blob for today — the card must stay hidden and the calendar owns the top.
  empty: null,

  // A reasonably full weekday: all five core sections + closer.
  typical: getMockDaybrief(),

  // Quiet Saturday — the brevity IS the message.
  quiet: brief({
    headline: 'Nothing on the calendar until swim at 11. Enjoy it.',
    sections: [
      {
        kind: 'today',
        title: 'Today',
        items: [{ time: '11:00', text: 'Swim lesson — Mabel' }],
      },
      {
        kind: 'kitchen',
        title: 'Kitchen',
        items: [{ text: 'No dinner plan yet — the short ribs in the freezer want a slow-cooker morning' }],
      },
    ],
    closer: '84 and sunny. The lawn can wait; it usually does.',
  }),

  // Nothing needed prep today — headline and closer carry the whole card.
  'headline-only': brief({
    headline: 'Clear calendar, stocked fridge, zero pressing to-dos. Suspicious.',
    closer: 'Checked twice. Go build something.',
  }),

  // Verbose worst case: long lines, many sections, an unknown section kind
  // (renders generically), items with and without time tokens mixed.
  overflow: brief({
    headline: 'Dense one today — three appointments, two deadlines, and a dinner that moved twice. The 2:30 is the one that will slip if you let it.',
    sections: [
      {
        kind: 'today',
        title: 'Today',
        items: [
          { time: '8:30', text: 'Daycare drop-off — Caroline has an early call, so this one is yours' },
          { time: '10:00', text: 'Dentist — the form they emailed twice is still unsigned in your downloads folder' },
          { time: '2:30', text: 'Contractor walkthrough at the house — he was 40 minutes late last time, plan around it' },
          { time: '6:30', text: 'Dinner with the Fregos, moved from Thursday, moved again from 7:00 — allegedly final' },
          { text: 'Work is wall-to-wall 9–4 with one gap at 1:15 — lunch is whatever survives in the fridge' },
        ],
      },
      {
        kind: 'errands',
        title: 'On your way home',
        items: [
          { text: 'CVS — Mabel’s prescription plus the passport photos you keep not taking' },
          { text: 'Package at the Amazon locker expires tomorrow — the one you forgot ordering' },
          { text: 'Gas — you coasted in on fumes Friday and the light has feelings now' },
        ],
      },
      {
        kind: 'comingup',
        title: 'Coming up',
        items: [
          { time: 'Wed', text: 'Car registration deadline — the renewal takes four minutes online, you have timed it' },
          { time: 'Thu', text: 'Passport appointment 9:40a — birth certificate, both parents, and Mabel in a cooperative mood' },
          { time: 'Sat', text: 'Aidan’s 3rd birthday, 2pm Marietta — gift unsorted, card unbought, RSVP already sent' },
        ],
      },
      {
        kind: 'kitchen',
        title: 'Kitchen',
        items: [
          { text: 'Salmon tonight is off — no lemons, no capers, and the salmon is actually chicken' },
          { text: 'Grocery list is at 14 items; Wednesday is the last realistic run before the weekend' },
        ],
      },
      {
        kind: 'mabel',
        title: 'Mabel',
        items: [
          { text: '4-month checkup Friday — insurance card is in the diaper bag side pocket, per Caroline' },
        ],
      },
      {
        kind: 'household-projects',
        title: 'House',
        items: [
          { text: 'Unknown-kind section: renders generically so Hermes can invent categories without a deploy' },
        ],
      },
    ],
    closer: 'Storms after 8 — bring the porch cushions in, or accept their journey.',
  }),
};

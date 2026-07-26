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

  // ── Real-data states (Tim's actual week of Jul 27, pulled 2026-07-26 via
  // mfb-calendar-show + gtask + open-meteo). These are the voice reference:
  // connected sentences, contractions, judgment attached to real facts.
  // Both carry `body` paragraphs so every flavor renders from one payload. ──

  // Monday → week readout: Headlines lead with the week's one real story,
  // Coming Up rides along (Sun/Mon/Thu are its days). Rail order is the
  // contract: Today → Needs a decision → Meals → Worth doing → Coming up.
  'real-monday': brief({
    bodyTitle: '🗞️ Headlines',
    headline: 'Clear morning, stacked afternoon. One decision pending.',
    body: [
      '🏫 **The week’s story is childcare.** Primrose wraps its year Wednesday and closes Thursday–Friday for teacher training. Tonight’s job: settle who has Mabel.',
      '🕛 **Today is two different days.** Nothing until noon, then meetings straight through 7:30. Real thinking happens this morning or not at all.',
      '🍼 **Mabel’s checkup is tomorrow at 1:00** — mid-meeting for you, so confirm Caroline’s on it. Four-month visits mean shots; plan a gentle evening.',
      '🌡️ **Heat builds all week.** 94 today, 99 tomorrow. Saturday brings Chloe’s heartworm pill and, at last, the air filter.',
    ],
    sections: [
      {
        kind: 'today',
        title: '🗓️ Today',
        items: [
          { time: 'Morning', text: 'Clear until noon — your one open stretch' },
          { time: '12:00', text: 'Meetings, wall-to-wall until 7:30' },
        ],
      },
      {
        kind: 'attention',
        title: '⚖️ Needs a decision',
        items: [
          { text: 'Who has Mabel **Thursday and Friday**? Primrose is closed both days.' },
        ],
      },
      {
        kind: 'meals',
        title: '🍽️ Meals',
        items: [
          { text: 'Running low on baby powder and Barebells — the weekend run covers it' },
        ],
      },
      {
        kind: 'todos',
        title: '✅ Worth doing',
        items: [
          { text: 'Start the GA 529 — it’s a form, not a project' },
          { text: 'Birth-certificate steps; paperwork is queued behind it' },
        ],
      },
      {
        kind: 'comingup',
        title: '🔭 Coming up',
        items: [
          { time: 'Tue', text: 'Mabel’s 4-month checkup, 1:00' },
          { time: 'Tue', text: 'Spiritual Direction, 6:30' },
          { time: 'Wed', text: 'Primrose’s last day of the year' },
          { time: 'Sat', text: 'Chloe’s heartworm pill · air filter' },
        ],
      },
    ],
    closer: '94 today, 99 tomorrow. The air filter picked a good week to matter.',
  }),

  // Tuesday → tight, today-focused: no Coming Up (it flashes Sun/Mon/Thu
  // unless something urgent), fewer Headlines, decision follow-through.
  'real-tuesday': brief({
    bodyTitle: '🗞️ Headlines',
    headline: 'Checkup day, 99 degrees. Plan a gentle evening.',
    body: [
      '🍼 **Mabel sees the doctor at 1:00.** Caroline has her; your 12:45 breather is enough time to call for the verdict. Expect shots and an early bedtime.',
      '💼 **Meetings run 11:35 through the evening**, then Spiritual Direction at 6:30. The morning is yours.',
      '🌡️ **It’s 99° out there.** Anything that can wait indoors, should.',
    ],
    sections: [
      {
        kind: 'today',
        title: '🗓️ Today',
        items: [
          { time: '11:35', text: 'Meetings begin' },
          { time: '1:00', text: 'Mabel’s 4-month checkup — Caroline has her' },
          { time: '6:30', text: 'Spiritual Direction' },
        ],
      },
      {
        kind: 'attention',
        title: '⚖️ Needs a decision',
        items: [
          { text: 'Thursday–Friday coverage: make sure last night’s plan is real' },
        ],
      },
      {
        kind: 'meals',
        title: '🍽️ Meals',
        items: [
          { text: 'What’s for dinner? 99° says takeout — that’s a plan, not a failure' },
        ],
      },
    ],
    closer: 'Stay near the air conditioning. Mabel has the right idea about naps.',
  }),

  // A reasonably full weekday: all five core sections + closer.
  typical: getMockDaybrief(),

  // Quiet Saturday — the brevity IS the message.
  quiet: brief({
    headline: 'Nothing on the calendar until swim at 11. Enjoy it.',
    sections: [
      {
        kind: 'today',
        title: '🗓️ Today',
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
        title: '🗓️ Today',
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
        title: '🔭 Coming up',
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

// State fixtures for the Family Calendar card (calendar.js). Rendered in
// isolation by the QA harness page (/harness.html?widget=calendar&state=…)
// and measured by tests/qa/calendar.spec.js.
//
// Browser-safe on purpose: no Playwright imports, no import.meta.env — this
// module is imported by BOTH the harness page (browser) and the specs (node).
//
// Dates are relative to `new Date()` AT MODULE LOAD. Specs freeze page time
// first (page.clock.install with tests/qa/clock.js FIXED_NOW), so in tests
// "now" is always Wed 07:30 and renders are deterministic; opened by a human
// without the clock mock, the same fixtures land on the real today.
import { getMockCalendar } from '../lib/calendar-mock.js';

const NOW = new Date();

// h:m today, ISO — matches the shape /api/calendar returns. All fixture times
// are after 07:30 so the card's "now → end of today" filter keeps them.
function at(h, m = 0) {
  const d = new Date(NOW);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function section(label, events) {
  return { label, events };
}

function evt(id, h, m, title, sub = '', extra = {}) {
  return { id, startsAt: at(h, m), endsAt: at(h + 1, m), title, sub, description: '', ...extra };
}

// A work-calendar event: true source calendar + person + kind, like the API
// emits for the merged person sections.
function workEvt(id, h, m, title, sub, person) {
  return evt(id, h, m, title, sub, { calendar: `${person} (Work)`, person, kind: 'work' });
}

// A column overflowing its share of the card — 8 events apiece.
function packedSection(label, count) {
  return section(label, Array.from({ length: count }, (_, i) =>
    evt(`${label.toLowerCase()}-${i}`, 8 + i, (i * 7) % 60, `${label} event ${i + 1}`, i % 3 === 0 ? 'Somewhere nearby' : '')));
}

// Week-grid helpers: events on arbitrary offset days (the `at`/`evt` helpers
// above are today-only). endsAt is explicit so blocks size proportionally.
function dayAt(offset, h, m = 0) {
  const d = new Date(NOW); d.setDate(d.getDate() + offset); d.setHours(h, m, 0, 0);
  return d.toISOString();
}
function dayYmd(offset) {
  const d = new Date(NOW); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function tevt(id, offset, sh, sm, eh, em, title) {
  return { id, startsAt: dayAt(offset, sh, sm), endsAt: dayAt(offset, eh, em), title, sub: '', description: '' };
}

// A representative family span for the time grid: a same-morning overlap (lane
// splitting), an early and a late event (proving the 5 AM–midnight scroll), two
// multi-day all-day events (the pinned spanning band), plus events in the past
// window (offset < 0) and the next window (offset ≥ 5) so ‹ › nav has content
// to reveal on both sides of today's 5-day window.
// A one-day all-day event (Google's exclusive end-date convention).
function adayEvt(id, offset, title, extra = {}) {
  return { id, title, allDay: true, startsAt: dayYmd(offset), endsAt: dayYmd(offset + 1), sub: '', description: '', ...extra };
}

// Dinner-lane events — the "Dinner: <meal>" all-day convention Nigel writes
// (lib/meals.js). Days 0–3 planned; day 4 deliberately empty so the lane's
// "ask Nigel…" nudge renders. "Dinner with Mom" (w4, timed) below must NOT
// land in the lane — it's an outing, not a plan.
const weekDinners = [
  adayEvt('w-din0', 0, 'Dinner: Salmon & corn'),
  adayEvt('w-din1', 1, 'Dinner: Slow-cooker chili'),
  adayEvt('w-din2', 2, 'Dinner: Tacos al pastor'),
  adayEvt('w-din3', 3, 'Dinner: Leftovers'),
];

// Horizon events (days 5–90) feeding the coming-up strip + sheet. With w10
// (day 5) and w11 (day 6) below, ELEVEN events are eligible — the picker caps
// at 8, so the strip reads "+5 more" and the ninth-onward never render.
const weekHorizon = [
  adayEvt('w-cu-pill', 6, 'Give Chloe heartworm pill'),
  adayEvt('w-cu-bday', 7, "Aidan's 3rd Birthday"),
  tevt('w-cu-flight', 12, 9, 40, 12, 55, 'Flight to NYC'),
  { ...tevt('w-cu-checkup', 19, 8, 30, 9, 15, '4-month check-up'), sub: 'Northside Pediatrics' },
  { id: 'w-cu-stay', title: 'Stay at Hamilton', allDay: true, startsAt: dayYmd(21), endsAt: dayYmd(24), sub: '', description: '' },
  tevt('w-cu-offsite', 33, 9, 0, 17, 0, 'Fall offsite'),
  tevt('w-cu-shower', 44, 14, 0, 16, 0, 'Baby shower for Kate'),
  adayEvt('w-cu-nonna', 62, 'Nonna & Pop arrive'),
  tevt('w-cu-extra', 70, 10, 0, 11, 0, 'Pumpkin patch trip'), // 9th+ eligible — proves the cap
];

const weekData = {
  sections: [{ label: 'Family', events: [
    tevt('w-p1', -4, 10, 0, 11, 0, 'Past dentist'),    // prev window
    tevt('w-p2', -2, 14, 0, 15, 0, 'Past playdate'),   // prev window
    ...weekDinners,
    ...weekHorizon,
    { id: 'w-camp', title: 'Camping Trip', allDay: true, startsAt: dayYmd(0), endsAt: dayYmd(2), sub: '', description: '' },
    { id: 'w-bday', title: "Emma's Birthday", allDay: true, startsAt: dayYmd(3), endsAt: dayYmd(4), sub: '', description: '' },
    // Long titles exercise the 2-line wrap (all-day bar + timed block) at the
    // real wall card width, where short titles wouldn't reveal it.
    { id: 'w-vbs', title: 'Parish Vacation Bible School Week', allDay: true, startsAt: dayYmd(2), endsAt: dayYmd(3), sub: '', description: '' },
    // Liturgical feast days (Catholic ICS feed) — own tint, stacked next to a
    // family all-day event so the distinct color reads at the wall.
    { id: 'w-feast1', title: 'The Transfiguration of the Lord', allDay: true, startsAt: dayYmd(1), endsAt: dayYmd(2), sub: '', description: '', liturgical: true, calendar: 'Catholic Calendar', person: 'Catholic' },
    { id: 'w-feast2', title: 'Saint Maximilian Kolbe, priest and martyr', allDay: true, startsAt: dayYmd(3), endsAt: dayYmd(4), sub: '', description: '', liturgical: true, calendar: 'Catholic Calendar', person: 'Catholic' },
    tevt('w-long', 0, 16, 0, 17, 30, 'Primrose teacher training session'),
    tevt('w1', 0, 9, 0, 10, 0, 'Grocery Run'),
    tevt('w2', 0, 10, 45, 12, 0, 'Coffee with Diane'), // overlaps w3
    tevt('w3', 0, 11, 0, 11, 30, "Dog's bath"),
    tevt('w4', 0, 19, 30, 20, 30, 'Dinner with Mom'),  // late → scroll proof
    tevt('w5', 1, 6, 30, 7, 15, 'Early gym'),          // early → scroll proof
    tevt('w6', 1, 12, 0, 13, 0, 'Lunch with Mom'),
    tevt('w7', 2, 9, 0, 10, 0, 'Stroller walk'),
    tevt('w8', 3, 11, 30, 12, 0, 'Dentist'),
    tevt('w9', 4, 13, 30, 14, 30, 'Client presentation'),
    tevt('w10', 5, 11, 0, 11, 45, 'Swim lesson'),      // next window
    tevt('w11', 6, 14, 0, 15, 0, 'Pottery class'),     // next window
  ] }],
  nextEventId: 'w1',
};

// The same week with NO dinner events: every today/future lane cell nudges
// "ask Nigel…" (past cells stay blank on paged windows).
const weekNoDinnersData = {
  sections: [{ label: 'Family', events: weekData.sections[0].events.filter(e => !String(e.title).startsWith('Dinner:')) }],
  nextEventId: 'w1',
};

// An all-day pile-up: feasts + two spans + singles stack the band to its new
// 4-row cap (2× on 2026-08-01) with more behind the clip — plus a full dinner
// lane, the worst realistic case for the card's vertical budget.
const weekAlldayHeavyData = {
  sections: [{ label: 'Family', events: [
    ...weekDinners,
    adayEvt('wh-din4', 4, 'Dinner: Sheet-pan gnocchi'),
    ...weekHorizon,
    { id: 'wh-camp', title: 'Camping Trip', allDay: true, startsAt: dayYmd(0), endsAt: dayYmd(3), sub: '', description: '' },
    { id: 'wh-lake', title: 'Peggs at the lake', allDay: true, startsAt: dayYmd(1), endsAt: dayYmd(4), sub: '', description: '' },
    { id: 'wh-vbs', title: 'Parish Vacation Bible School Week', allDay: true, startsAt: dayYmd(0), endsAt: dayYmd(5), sub: '', description: '' },
    adayEvt('wh-feast1', 1, 'The Transfiguration of the Lord', { liturgical: true, calendar: 'Catholic Calendar', person: 'Catholic' }),
    adayEvt('wh-feast2', 3, 'Saint Maximilian Kolbe, priest and martyr', { liturgical: true, calendar: 'Catholic Calendar', person: 'Catholic' }),
    adayEvt('wh-supplies', 2, 'School supply drop-off'),
    adayEvt('wh-spirit', 4, 'Spirit week'),
    tevt('wh1', 0, 9, 0, 10, 0, 'Grocery Run'),
    tevt('wh2', 2, 11, 0, 12, 0, 'Stroller walk'),
  ] }],
  nextEventId: 'wh1',
};

export const states = {
  // The wall default — the rolling 5-day time grid.
  week: { data: weekData, flavor: 'week' },

  // No "Dinner:" events → the lane nudges "ask Nigel…" on every future day.
  'week-no-dinners': { data: weekNoDinnersData, flavor: 'week' },

  // All-day pile-up against the doubled band cap + a full dinner lane.
  'week-allday-heavy': { data: weekAlldayHeavyData, flavor: 'week' },

  // Family linked but empty (Tim/Caroline present in the feed but hidden) →
  // the card renders one Family column reading "Nothing scheduled."
  empty: {
    data: { sections: [section('Tim', []), section('Family', []), section('Caroline', [])], nextEventId: null },
  },

  // No Family section at all → the sole (Family) column shows the
  // "Not linked yet" placeholder. The stray Tim event is dropped, not shown.
  unlinked: {
    data: { sections: [section('Tim', [evt('t1', 9, 0, 'Recruiter call — Tessa', 'Phone')])], nextEventId: 't1' },
  },

  single: {
    data: { sections: [section('Tim', []), section('Family', [evt('f1', 15, 30, 'Pediatrician — Mabel', 'Northside Pediatrics')]), section('Caroline', [])], nextEventId: 'f1' },
  },

  // The standard demo data the dashboard falls back to (default flavor).
  typical: { data: getMockCalendar(NOW) },

  // Same data through each alternate flavor — the 2026-07-11 row-layout
  // exploration. `flavor` rides the fixture; the harness passes it through.
  'typical-rail': { data: getMockCalendar(NOW), flavor: 'rail' },
  'typical-days': { data: getMockCalendar(NOW), flavor: 'days' },
  'typical-classic': { data: getMockCalendar(NOW), flavor: 'classic' },

  // Every column packed — what does the card do when a day is genuinely full?
  overflow: {
    data: { sections: [section('Tim', []), packedSection('Family', 12), section('Caroline', [])], nextEventId: 'family-0' },
  },

  // Hidden-people regression fixture: the feed is dominated by Tim (work +
  // personal) and Caroline (Outlook) rows, with a single Family event. The
  // card must render ONLY that Family event — every Tim/Caroline row is
  // dropped. Work rows titled "Busy" mirror the Instacart free/busy feed.
  'work-dense': {
    data: {
      sections: [
        section('Family', [evt('fam-1', 15, 30, 'Pediatrician — Mabel', 'Northside Pediatrics')]),
        section('Tim', [
          workEvt('tw-0', 9, 0, 'Busy', 'Zoom', 'Tim'),
          workEvt('tw-1', 10, 30, 'Product review — a deliberately long meeting title for wrap testing', 'Zoom', 'Tim'),
          evt('tp-0', 12, 0, 'Lunch with Dave', 'Midtown'),
          workEvt('tw-2', 13, 0, 'Busy', '', 'Tim'),
          workEvt('tw-3', 14, 30, 'Roadmap deep-dive', 'Conf Rm 2', 'Tim'),
          evt('tp-1', 16, 0, 'Recruiter call — Tessa', 'Phone'),
          workEvt('tw-4', 17, 0, 'Busy', '', 'Tim'),
          workEvt('tw-5', 18, 0, 'Board prep', '', 'Tim'), // 8th event — over the 7-row cap
        ]),
        section('Caroline', [
          workEvt('cw-0', 9, 30, 'Team standup', 'Teams', 'Caroline'),
          workEvt('cw-1', 11, 0, 'Quarterly planning', 'Conf Rm 4B', 'Caroline'),
          workEvt('cw-2', 13, 30, 'Client presentation', 'Teams', 'Caroline'),
        ]),
      ],
      nextEventId: 'tw-0',
    },
  },

  // Family flooded + a hidden Tim event, long title exercising the single-
  // line ellipsis. The card shows Family's first 7 rows; the Tim row is
  // dropped, not squeezed in.
  uneven: {
    data: {
      sections: [
        section('Family', [
          ...packedSection('Family', 12).events,
          evt('family-long', 20, 30, 'An intentionally very long family event title that must ellipsize on one compact line', 'Somewhere with an equally long location name'),
        ]),
        section('Tim', [evt('tim-late', 20, 0, 'Spiritual Direction')]),
      ],
      nextEventId: 'family-0',
    },
  },
};

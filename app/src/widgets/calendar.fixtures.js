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

export const states = {
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

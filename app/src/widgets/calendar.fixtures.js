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

function evt(id, h, m, title, sub = '') {
  return { id, startsAt: at(h, m), endsAt: at(h + 1, m), title, sub, description: '' };
}

// A column overflowing its share of the card — 8 events apiece.
function packedSection(label, count) {
  return section(label, Array.from({ length: count }, (_, i) =>
    evt(`${label.toLowerCase()}-${i}`, 8 + i, (i * 7) % 60, `${label} event ${i + 1}`, i % 3 === 0 ? 'Somewhere nearby' : '')));
}

export const states = {
  // All three calendars linked, nothing scheduled — the state Tim flagged as
  // a design gap (should it show upcoming events instead of three blanks?).
  empty: {
    data: { sections: [section('Tim', []), section('Family', []), section('Caroline', [])], nextEventId: null },
  },

  // Caroline's calendar not linked yet → "Not linked yet" placeholder column.
  unlinked: {
    data: { sections: [section('Tim', [evt('t1', 9, 0, 'Recruiter call — Tessa', 'Phone')]), section('Family', [])], nextEventId: 't1' },
  },

  single: {
    data: { sections: [section('Tim', []), section('Family', [evt('f1', 15, 30, 'Pediatrician — Mabel', 'Northside Pediatrics')]), section('Caroline', [])], nextEventId: 'f1' },
  },

  // The standard demo data the dashboard falls back to.
  typical: { data: getMockCalendar(NOW) },

  // Every column packed — what does the card do when a day is genuinely full?
  overflow: {
    data: { sections: [section('Tim', []), packedSection('Family', 12), section('Caroline', [])], nextEventId: 'family-0' },
  },
};

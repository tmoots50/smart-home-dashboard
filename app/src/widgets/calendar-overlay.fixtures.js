// State fixtures for the expanded 7-day calendar overlay (calendar-overlay.js).
// Rendered by /harness.html?widget=calendar-overlay&state=… and measured by
// tests/qa/calendar-overlay.spec.js.
//
// Browser-safe: no Playwright imports, no import.meta.env. Dates are relative
// to `new Date()` at module load — specs freeze page time via
// page.clock.install(FIXED_NOW) before navigation, making renders
// deterministic (see tests/qa/clock.js).
import { getMockUpcoming } from '../lib/calendar-mock.js';

const NOW = new Date();
const CALENDARS = ['Tim', 'Family', 'Caroline'];

function day(offset) {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function at(offset, h, m = 0) {
  const d = day(offset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function evt(i, offset, h, title, extra = {}) {
  return {
    id: `fx-${i}`,
    calendar: CALENDARS[i % CALENDARS.length],
    title,
    sub: i % 3 === 0 ? 'Somewhere nearby' : '',
    description: i % 4 === 0 ? 'Details worth a drill-down tap.' : '',
    startsAt: at(offset, h),
    endsAt: at(offset, h + 1),
    allDay: false,
    ...extra,
  };
}

// A packed week: ~36 timed events across all 7 days plus a multi-day all-day
// span — the state that answers "what gets pushed off screen, and where does
// the ideal cutoff sit?".
function overflowWeek() {
  const events = [];
  let i = 0;
  for (let offset = 0; offset < 7; offset++) {
    for (const h of [7, 9, 11, 13, 15, 17, 19]) {
      if ((offset + h) % 3 === 0) continue; // thin it slightly so days differ
      events.push(evt(i++, offset, h, `Event ${i} — day ${offset}`));
    }
  }
  events.push({ id: 'fx-allday', calendar: 'Family', title: 'Grandma visiting', sub: '', description: '', startsAt: ymd(day(1)), endsAt: ymd(day(3)), allDay: true });
  return events;
}

export const states = {
  // Nothing at all, anywhere — the calm floor: one "nothing scheduled" line.
  empty: [],

  // Nothing in the next 7 days but a busy month beyond — exercises the
  // "Coming up" fill and its EMPTY_NEXT_MAX cap (15 later events > cap of 12).
  'empty-with-later': Array.from({ length: 15 }, (_, i) =>
    evt(200 + i, 8 + i, 9 + (i % 8), `Later event ${i + 1}`)),

  single: [evt(0, 2, 10, 'Recruiter call — Tessa')],

  // The standard demo mix: timed + all-day across all three calendars.
  typical: getMockUpcoming(NOW),

  overflow: overflowWeek(),

  // All-day pinning stress: several all-day events stacked on the same days.
  'all-day-heavy': [
    { id: 'ad-1', calendar: 'Family', title: 'Grandma visiting', sub: '', description: '', startsAt: ymd(day(0)), endsAt: ymd(day(2)), allDay: true },
    { id: 'ad-2', calendar: 'Tim', title: 'Conference — virtual', sub: '', description: '', startsAt: ymd(day(0)), endsAt: ymd(day(1)), allDay: true },
    { id: 'ad-3', calendar: 'Caroline', title: 'Offsite', sub: '', description: '', startsAt: ymd(day(1)), endsAt: ymd(day(1)), allDay: true },
    evt(90, 0, 12, 'Lunch with Dave'),
    evt(91, 1, 9, 'Standup'),
  ],
};

// State fixtures for the month-calendar overlay (month-calendar.js).
// Shape: { months: { '<year>-<month0>': events[] } } — the harness serves
// them through a stub getMonth(), so prev/next nav works across keys.
// Dates are relative to `new Date()` at module load; specs freeze page time
// (page.clock.install(FIXED_NOW)) before navigation for determinism.
import { getMockMonth } from '../lib/calendar-mock.js';

const NOW = new Date();
const Y = NOW.getFullYear();
const M = NOW.getMonth();
const key = (y, m) => `${y}-${m}`;
const nextM = new Date(Y, M + 1, 1);
const prevM = new Date(Y, M - 1, 1);

const at = (day, h, min = 0) => new Date(Y, M, day, h, min).toISOString();
const ymd = (day) => {
  const d = new Date(Y, M, day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const evt = (id, calendar, title, day, h, extra = {}) => ({
  id, calendar, title, sub: '', description: 'Details worth a drill-down tap.',
  startsAt: at(day, h), endsAt: at(day, h + 1), allDay: false, ...extra,
});

export const states = {
  empty: { months: {} },

  typical: { months: { [key(Y, M)]: getMockMonth(Y, M) } },

  // Six FAMILY events stacked on the 10th → 3 chips + "+3 more" → day-detail
  // sheet. Two hidden Tim/Caroline rows ride along on the same day to prove
  // they're filtered before the chip/more math runs.
  overflow: {
    months: {
      [key(Y, M)]: [
        evt('o1', 'Family', 'Pediatrician', 10, 8),
        evt('o2', 'Tim (Work)', 'Product review', 10, 9, { person: 'Tim', kind: 'work' }),   // hidden
        evt('o3', 'Family', 'Swim lesson', 10, 11),
        evt('o4', 'Caroline (Work)', 'Offsite', 10, 12, { person: 'Caroline', kind: 'work', readOnly: true }), // hidden
        evt('o5', 'Family', 'Dentist', 10, 13),
        evt('o6', 'Family', 'Dinner with the Fregos', 10, 15),
        evt('o7', 'Family', 'Book club', 10, 17),
        evt('o8', 'Family', 'Evening walk', 10, 19),
        evt('o9', 'Family', 'Farmers market', 12, 9),
      ],
    },
  },

  // Multi-day span mid-month + one that started LAST month and is still
  // running on day 1 (must clamp onto day 1, not vanish).
  'all-day-span': {
    months: {
      [key(Y, M)]: [
        { id: 's1', calendar: 'Family', title: 'Grandma visiting', sub: '', description: '', startsAt: ymd(14), endsAt: ymd(17), allDay: true },
        {
          id: 's2', calendar: 'Family', title: 'Conference — running since last month', sub: '', description: '',
          startsAt: `${prevM.getFullYear()}-${String(prevM.getMonth() + 1).padStart(2, '0')}-27`,
          endsAt: ymd(3),
          allDay: true,
        },
        evt('s3', 'Family', 'Swim lesson', 21, 11),
      ],
    },
  },

  // Events in the current AND adjacent months — nav must swap data sets.
  'adjacent-months': {
    months: {
      [key(Y, M)]: [evt('a1', 'Family', 'This month event', 15, 10)],
      [key(nextM.getFullYear(), nextM.getMonth())]: [{
        id: 'a2', calendar: 'Family', title: 'Next month event', sub: '', description: '',
        startsAt: new Date(nextM.getFullYear(), nextM.getMonth(), 8, 9).toISOString(),
        endsAt: new Date(nextM.getFullYear(), nextM.getMonth(), 8, 10).toISOString(),
        allDay: false,
      }],
      [key(prevM.getFullYear(), prevM.getMonth())]: [],
    },
  },
};

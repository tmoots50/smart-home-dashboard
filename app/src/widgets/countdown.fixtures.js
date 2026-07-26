// State fixtures for the two-pane Coming-Up card. Dates are relative to
// `new Date()` at module load; specs freeze page time (page.clock.install
// FIXED_NOW = Wed) so the left-pane window (next Sun → +28d) is deterministic.
//
// Window cheat-sheet from a Wednesday: this week = +0..+3 (excluded from the
// left pane), next Sunday = +4, left window = +4..+31, right = planning items
// anywhere in +0..+89 that aren't already on the left.
const NOW = new Date();

function at(offset, hour = 10) {
  const d = new Date(NOW); d.setDate(d.getDate() + offset); d.setHours(hour, 0, 0, 0); return d.toISOString();
}
function ymd(offset) {
  const d = new Date(NOW); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const evt = (id, title, offset, over = {}) => ({
  id, calendar: 'Family', title, startsAt: at(offset, over.hour ?? 10), sub: '', allDay: false, ...over,
});

// Left agenda: one of each category + plain events, all beyond this week.
const LEFT = [
  evt('r1', 'Give Chloe heartworm pill', 5, { recurring: true }),
  evt('p1', 'Lunch with Sarah', 6, { sub: 'Buckhead' }),
  evt('b1', "Aidan's 3rd Birthday", 7, { sub: '3012 Andora Dr SW, Marietta, GA, United States' }),
  evt('m1', '4 month check up', 9, { sub: 'Lighthouse Pediatrics 3610 Piedmont Rd NE, Ste 100, Atlanta, GA 30305' }),
  evt('p2', 'Dinner with the Fregos', 12),
  evt('p3', 'Manicure and Pedicure', 18, { sub: 'La Belle Buckhead' }),
];

// Planning radar: travel/offsite/big-effort/vague across the 90-day window,
// including one THIS-week flight (excluded from left, still planning-worthy).
const RIGHT = [
  evt('t1', 'Flight to NYC', 2, { hour: 8 }),
  evt('t2', 'Stay at Hamilton', 35, { allDay: true, startsAt: ymd(35), endsAt: ymd(38) }),
  evt('o1', 'Narvar offsite', 45),
  evt('g1', 'Baby shower for Kate', 60),
  evt('v1', 'Plan 529 college fund', 75),
];

// Near-term events: they fill the calendar card's six per-person slots (the
// left pane excludes whatever the card shows) and must appear in NEITHER
// pane themselves.
const THIS_WEEK = [
  evt('w1', 'This week thing', 1),
  evt('w2', 'Water hanging planters', 0, { hour: 20, recurring: true }),
  evt('w3', 'Lunch with Mom', 1, { hour: 12 }),
  evt('w4', 'Water hanging planters', 1, { hour: 20, recurring: true }),
  evt('w5', 'Stroller walk', 1, { hour: 9 }),
  evt('w6', 'Trash & recycling out', 1, { hour: 19, recurring: true }),
];

export const states = {
  empty: [],

  typical: [...LEFT, ...RIGHT, ...THIS_WEEK],

  // Hidden-people demo: the feed carries Tim/Caroline items that must be
  // dropped, leaving only Family. Tim's flight is hidden; the Family trip
  // still surfaces in the plan-ahead pane.
  mixed: [
    evt('x1', 'Family swim lesson', 5),
    evt('x2', 'Recruiter call', 6, { calendar: 'Tim' }),             // hidden
    evt('x3', 'Book club', 8, { calendar: 'Caroline' }),             // hidden
    evt('x4', 'Flight to Denver', 40, { calendar: 'Tim', hour: 7 }), // hidden (Tim travel)
    evt('x5', 'Family trip to the coast', 45, { allDay: true, startsAt: ymd(45), endsAt: ymd(48) }), // Family → plan-ahead
  ],

  // Both panes overflow their scroll regions.
  overflow: [
    ...Array.from({ length: 14 }, (_, i) =>
      evt(`of-l${i}`, `Family event ${i}`, 5 + i, { sub: i % 2 ? 'Piedmont Park, Atlanta' : '' })),
    ...Array.from({ length: 8 }, (_, i) =>
      evt(`of-r${i}`, `Trip ${i} to the lake house`, 33 + i * 7, { allDay: true, startsAt: ymd(33 + i * 7), endsAt: ymd(35 + i * 7) })),
  ],
};

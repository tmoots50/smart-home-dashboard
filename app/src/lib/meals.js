// Dinner-lane data. The system of record is the Family Google calendar:
// Nigel (or anyone) creates an ALL-DAY event titled "Dinner: <meal>" on the
// day it's planned — e.g. "Dinner: Enchiladas" — and the week grid's dinner
// lane picks it up on the next refresh. The lane is a projection of calendar
// events, never a separate store.
//
// Future sources (an Instacart-cart-derived plan, a meal-planning app) slot in
// HERE: extend dinnersByDay to merge another feed into the same day→meal map.
// The widget only consumes the map; it never knows where a meal came from.
//
// The "Dinner:" prefix is deliberately strict-ish: it requires a separator
// (colon or dash) so a real outing titled "Dinner at the Petersons" stays a
// normal all-day event instead of being swallowed by the lane. Tolerated:
// "Dinner: X", "dinner - X", "Dinner — X".

const DINNER_RX = /^\s*dinner\s*[:\-–—]\s*(\S.*)$/i;

// "Dinner: Enchiladas" → "Enchiladas"; null when the title isn't a dinner plan.
export function dinnerLabel(title) {
  const m = DINNER_RX.exec(String(title ?? ''));
  return m ? m[1].trim() : null;
}

// A planned-meal event: all-day + "Dinner:"-titled. These render in the dinner
// lane and are EXCLUDED from the all-day band and the coming-up strip.
export function isDinnerEvent(event) {
  return Boolean(event?.allDay && dinnerLabel(event.title) != null);
}

// Local YYYY-MM-DD for a Date (all-day startsAt already arrives in this shape).
export function ymdLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// events → Map of 'YYYY-MM-DD' → { label, event }. One meal per day: on a
// double-booked day the first by (startsAt, title) wins deterministically —
// fix the calendar, not the lane. Multi-day dinner events count only on their
// start day (dinner is a one-evening plan; a spanning one is a data mistake).
export function dinnersByDay(events) {
  const dinners = (events ?? [])
    .filter(isDinnerEvent)
    .sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)) || String(a.title).localeCompare(String(b.title)));
  const byDay = new Map();
  for (const event of dinners) {
    const day = String(event.startsAt).slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, { label: dinnerLabel(event.title), event });
  }
  return byDay;
}

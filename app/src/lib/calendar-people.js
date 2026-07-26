// Single source of truth for which household people are HIDDEN from the
// dashboard's calendar surfaces (the card, the See-more overlay, the month
// view, and the Coming-Up radar).
//
// This is a PRESENTATION filter only — Tim's and Caroline's calendars still
// sync (Hermes, /api/calendar, the month/upcoming feeds are untouched). We
// simply don't render their columns, sections, legend entries, or events on
// the wall. Removing a name from HIDDEN_PEOPLE brings that person back on
// every surface at once; that's the whole point of centralizing it here.
//
// Matching is person-keyed. Every calendar surface resolves an event to a
// person via `personOf` (the event's `person`, else its raw `calendar` for
// pre-multi-source events). "Tim (Work)" and "Caroline (Work)" reduce to
// their base person, so a work feed is hidden with its owner.

export const HIDDEN_PEOPLE = ['Tim', 'Caroline'];

const norm = (s) => String(s ?? '').trim().toLowerCase();
const HIDDEN_SET = new Set(HIDDEN_PEOPLE.map(norm));

// Person a hidden check runs against: the event's person, or its raw calendar
// for events that predate the multi-source split.
export function personOf(ev) {
  return ev?.person || ev?.calendar || '';
}

// A person label is hidden if it matches a hidden name, or is that person's
// parenthesized source feed ("Tim (Work)" → base "Tim"). The base check only
// fires when a suffix was actually stripped, so "Timothy" never matches "Tim".
export function isHiddenPerson(label) {
  const n = norm(label);
  if (HIDDEN_SET.has(n)) return true;
  const base = n.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return base !== n && HIDDEN_SET.has(base);
}

export function isHiddenEvent(ev) {
  return isHiddenPerson(personOf(ev));
}

// Drop hidden people's events from a flat event list.
export function visibleEvents(events) {
  return (events ?? []).filter(ev => !isHiddenEvent(ev));
}

// Drop hidden people from a roster / column / legend label list.
export function visibleRoster(labels) {
  return (labels ?? []).filter(label => !isHiddenPerson(label));
}

// Drop hidden people's whole sections (label-keyed) AND scrub any hidden
// event that slipped into a still-visible section.
export function visibleSections(sections) {
  return (sections ?? [])
    .filter(s => !isHiddenPerson(s.label))
    .map(s => ({ ...s, events: visibleEvents(s.events) }));
}

import { describe, it, expect } from 'vitest';
import { rankComingUp, classify, weekEnd, normalizeItem, CARD_MAX_PER_COLUMN } from './comingup.js';

// Wednesday 2026-07-15 → "this week" runs through Sat Jul 18; the left pane
// window is [Sun Jul 19, Sun Aug 16).
const NOW = new Date('2026-07-15T07:30:00');

const ev = (over) => normalizeItem({
  id: over.id ?? `${over.title}|${over.startsAt}`,
  calendar: 'Family', title: 'Event', sub: '', allDay: false, ...over,
});

// Near-term Family events that occupy ALL of the calendar card's slots
// (CARD_MAX_PER_COLUMN), so window/dedupe tests exercise the rules on the
// events they actually target. Mirrors reality: the family calendar is dense
// in the near term, so the card's slots fill within a day or two.
const cardFillers = (day = '2026-07-15') => Array.from({ length: CARD_MAX_PER_COLUMN }, (_, i) =>
  ev({ id: `fill-${i}`, title: `Card filler ${i}`, startsAt: `${day}T${String(8 + i).padStart(2, '0')}:00:00` }));

describe('weekEnd', () => {
  it('returns the Sunday after the current Sun–Sat week', () => {
    expect(weekEnd(NOW).toDateString()).toBe(new Date(2026, 6, 19).toDateString());
    // Already Sunday → the NEXT Sunday (this week just started).
    expect(weekEnd(new Date('2026-07-19T10:00:00')).toDateString())
      .toBe(new Date(2026, 6, 26).toDateString());
    // Saturday night still belongs to this week.
    expect(weekEnd(new Date('2026-07-18T23:00:00')).toDateString())
      .toBe(new Date(2026, 6, 19).toDateString());
  });
});

describe('classify', () => {
  const cat = (over) => classify(ev(over)).category;

  it('detects birthdays, Mabel, travel, recurring', () => {
    expect(cat({ title: "Aidan's 3rd Birthday" })).toBe('birthday');
    expect(cat({ title: '4 month check up', sub: 'Lighthouse Pediatrics' })).toBe('mabel');
    expect(cat({ title: 'Flight to Denver' })).toBe('travel');
    expect(cat({ title: 'Give Chloe heartworm pill' })).toBe('recurring');
    expect(cat({ title: 'Lunch with Mom' })).toBe(null);
  });

  it('prefers birthday over other matching signals', () => {
    expect(cat({ title: "Mabel's 1st birthday trip" })).toBe('birthday');
  });

  it('treats a multi-day all-day event as travel needing planning', () => {
    const trip = classify(ev({ title: 'Stay at Hamilton', allDay: true, startsAt: '2026-08-07', endsAt: '2026-08-10' }));
    expect(trip.category).toBe('travel');
    expect(trip.needsPlanning).toBe(true);
  });

  it('flags offsites and vague/big-effort items as needing planning', () => {
    expect(classify(ev({ title: 'Narvar team offsite' })).needsPlanning).toBe(true);
    expect(classify(ev({ title: 'Plan 529 college fund' })).needsPlanning).toBe(true);
    expect(classify(ev({ title: 'Baby shower for Kate' })).needsPlanning).toBe(true);
    expect(classify(ev({ title: 'Dentist' })).needsPlanning).toBe(false);
  });

  it('respects the API recurring flag without a pattern match', () => {
    expect(classify(ev({ title: 'Spiritual Direction', recurring: true })).category).toBe('recurring');
  });
});

describe('rankComingUp', () => {
  it('left pane excludes this week, includes the next four, chronological', () => {
    const { left } = rankComingUp([
      ...cardFillers(),
      ev({ title: 'This week thing', startsAt: '2026-07-17T10:00:00' }),   // Fri this week
      ev({ title: 'Week 2 thing', startsAt: '2026-07-24T10:00:00' }),
      ev({ title: 'Week 1 thing', startsAt: '2026-07-20T10:00:00' }),
      ev({ title: 'Beyond 4 weeks', startsAt: '2026-08-20T10:00:00' }),
    ], { now: NOW });
    expect(left.map(i => i.name)).toEqual(['Week 1 thing', 'Week 2 thing']);
  });

  it('left pane enforces the 3-day lead even when the new week starts sooner', () => {
    // Saturday: "not this week" alone would admit tomorrow (Sunday).
    const SAT = new Date('2026-07-18T07:30:00');
    const { left } = rankComingUp([
      ...cardFillers('2026-07-18'),
      ev({ title: 'Sunday thing', startsAt: '2026-07-19T10:00:00' }),  // +1
      ev({ title: 'Monday thing', startsAt: '2026-07-20T10:00:00' }),  // +2
      ev({ title: 'Tuesday thing', startsAt: '2026-07-21T10:00:00' }), // +3 — first eligible
    ], { now: SAT });
    expect(left.map(i => i.name)).toEqual(['Tuesday thing']);
  });

  it('left pane never repeats what the calendar card is showing (first CARD_MAX_PER_COLUMN per person)', () => {
    // Two more in-window Family events than the card holds: the card shows
    // the first CARD_MAX_PER_COLUMN, so only the last two belong here.
    const total = CARD_MAX_PER_COLUMN + 2;
    const events = Array.from({ length: total }, (_, i) =>
      ev({ id: `w-${i}`, title: `Window event ${i}`, startsAt: `2026-07-${20 + i}T10:00:00` }));
    const { left } = rankComingUp(events, { now: NOW });
    expect(left.map(i => i.name)).toEqual([`Window event ${total - 2}`, `Window event ${total - 1}`]);
  });

  it('right pane keeps only planning-worthy items, ordered by importance', () => {
    const { right } = rankComingUp([
      ev({ title: 'Dinner with the Fregos', startsAt: '2026-09-01T18:00:00' }),   // not planning
      ev({ title: 'Baby shower for Kate', startsAt: '2026-09-20T14:00:00' }),     // big effort 60
      ev({ title: 'Flight to Denver', startsAt: '2026-10-01T08:00:00' }),         // travel 100
      ev({ title: 'Narvar offsite', startsAt: '2026-09-10T09:00:00' }),           // offsite 90
    ], { now: NOW });
    expect(right.map(i => i.name)).toEqual(['Flight to Denver', 'Narvar offsite', 'Baby shower for Kate']);
  });

  it('never duplicates a left-pane event on the right', () => {
    const flight = ev({ title: 'Flight to Denver', startsAt: '2026-07-25T08:00:00' }); // in left window
    const { left, right } = rankComingUp([...cardFillers(), flight], { now: NOW });
    expect(left.map(i => i.name)).toEqual(['Flight to Denver']);
    expect(right).toEqual([]);
  });

  it('planning items inside THIS week still surface on the right', () => {
    const { right } = rankComingUp([
      ev({ title: 'Flight to NYC', startsAt: '2026-07-17T08:00:00' }), // this week → not left
    ], { now: NOW });
    expect(right.map(i => i.name)).toEqual(['Flight to NYC']);
  });

  it('collapses repeating series to their first occurrence', () => {
    const { left } = rankComingUp([
      ...cardFillers(),
      ev({ id: 'w1', title: 'Water Hanging Planters', startsAt: '2026-07-20T20:00:00' }),
      ev({ id: 'w2', title: 'Water Hanging Planters', startsAt: '2026-07-21T20:00:00' }),
      ev({ id: 'w3', title: 'Water Hanging Planters', startsAt: '2026-07-22T20:00:00' }),
    ], { now: NOW });
    expect(left).toHaveLength(1);
    expect(left[0].id).toBe('w1');
  });

  it('drops past events and events beyond 90 days', () => {
    const { left, right } = rankComingUp([
      ev({ title: 'Yesterday', startsAt: '2026-07-14T10:00:00' }),
      ev({ title: 'Flight far out', startsAt: '2026-11-01T10:00:00' }), // > 90d
    ], { now: NOW });
    expect(left).toEqual([]);
    expect(right).toEqual([]);
  });

  it('computes days-from-today for display', () => {
    const { left } = rankComingUp([...cardFillers(), ev({ title: 'X', startsAt: '2026-07-20T10:00:00' })], { now: NOW });
    expect(left[0].days).toBe(5);
  });

  it('excludes Tim and Caroline events from both panes (hidden everywhere)', () => {
    const { left, right } = rankComingUp([
      ...cardFillers(),                                                                 // occupy the card's near-term slots
      ev({ title: 'Family agenda item', startsAt: '2026-07-24T10:00:00' }),            // Family, left window
      ev({ title: 'Family trip', startsAt: '2026-09-01T10:00:00' }),                   // Family, right (travel)
      ev({ calendar: 'Tim', title: 'Recruiter call', startsAt: '2026-07-24T11:00:00' }), // Tim → hidden
      ev({ calendar: 'Tim (Work)', person: 'Tim', kind: 'work', title: 'Narvar offsite', startsAt: '2026-09-05T09:00:00' }), // Tim work → hidden
      ev({ calendar: 'Caroline (Work)', person: 'Caroline', title: 'Client presentation', startsAt: '2026-07-25T09:00:00' }), // Caroline → hidden
    ], { now: NOW });
    const names = [...left, ...right].map(i => i.name);
    expect(names).toContain('Family agenda item');
    expect(names).toContain('Family trip');
    expect(names).not.toContain('Recruiter call');
    expect(names).not.toContain('Narvar offsite');
    expect(names).not.toContain('Client presentation');
  });

  it('excludes liturgical feast days from both panes (week grid + month only — Coming Up is family)', () => {
    const { left, right } = rankComingUp([
      ...cardFillers(),
      ev({ title: 'Family agenda item', startsAt: '2026-07-24T10:00:00' }),                 // Family, left window → keep
      ev({ calendar: 'Catholic Calendar', person: 'Catholic', liturgical: true, allDay: true,
           title: 'The Assumption of the Blessed Virgin Mary', startsAt: '2026-07-24' }),   // feast in left window → drop
      ev({ calendar: 'Catholic Calendar', person: 'Catholic', liturgical: true, allDay: true,
           title: 'Octave of a Long Feast', startsAt: '2026-09-01', endsAt: '2026-09-05' }), // multi-day → would be "travel"/right, but drop
    ], { now: NOW });
    const names = [...left, ...right].map(i => i.name);
    expect(names).toContain('Family agenda item');           // non-liturgical family event still shows
    expect(names).not.toContain('The Assumption of the Blessed Virgin Mary');
    expect(names).not.toContain('Octave of a Long Feast');
  });
});

describe('rankComingUp overrides (the Hermes hand)', () => {
  const items = [
    ...cardFillers(),
    ev({ title: 'Lunch with Sarah', startsAt: '2026-07-20T12:00:00' }),      // left window
    ev({ title: 'Flight to Denver', startsAt: '2026-10-01T08:00:00' }),      // right, travel 100
    ev({ title: 'Narvar offsite', startsAt: '2026-09-10T09:00:00' }),        // right, offsite 90
    ev({ title: 'Dinner with the Fregos', startsAt: '2026-09-01T18:00:00' }),// nowhere (not planning)
  ];

  it('hide drops the event everywhere', () => {
    const { left } = rankComingUp(items, { now: NOW, overrides: [{ match: 'lunch with sarah', hide: true }] });
    expect(left.map(i => i.name)).not.toContain('Lunch with Sarah');
  });

  it('score reorders the plan-ahead pane', () => {
    const { right } = rankComingUp(items, { now: NOW, overrides: [{ match: 'Narvar', score: 500 }] });
    expect(right[0].name).toBe('Narvar offsite');
  });

  it('scored left items float above the chronological agenda', () => {
    const { left } = rankComingUp([
      ...cardFillers(),
      ev({ title: 'Early thing', startsAt: '2026-07-20T09:00:00' }),
      ev({ title: 'Late thing', startsAt: '2026-08-01T09:00:00' }),
    ], { now: NOW, overrides: [{ match: 'Late thing', score: 10 }] });
    expect(left.map(i => i.name)).toEqual(['Late thing', 'Early thing']);
  });

  it('pane forces placement past the window rules, no dupes', () => {
    const { left, right } = rankComingUp(items, {
      now: NOW,
      overrides: [{ match: 'Dinner with the Fregos', pane: 'right', score: 1 }, { match: 'Flight to Denver', pane: 'left' }],
    });
    expect(right.map(i => i.name)).toContain('Dinner with the Fregos');
    expect(left.map(i => i.name)).toContain('Flight to Denver');
    expect(right.map(i => i.name)).not.toContain('Flight to Denver');
  });

  it('matches by exact id as well as title substring', () => {
    const flagged = ev({ id: 'evt-42', title: 'Mystery block', startsAt: '2026-07-21T10:00:00' });
    const { left } = rankComingUp([flagged], { now: NOW, overrides: [{ match: 'evt-42', hide: true }] });
    expect(left).toEqual([]);
  });
});

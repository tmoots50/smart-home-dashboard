import { describe, it, expect } from 'vitest';
import { renderCalendarOverlay, groupByDay, groupByPerson, splitByHorizon, openCalendarOverlay } from './calendar-overlay.js';
import { getMockUpcoming } from '../lib/calendar-mock.js';

const NOW = new Date('2026-07-08T08:00:00'); // local

const ev = (over) => ({
  id: 'x', calendar: 'Family', title: 'Event', sub: '',
  startsAt: '2026-07-08T15:00:00-04:00', endsAt: '', allDay: false, ...over,
});

describe('groupByDay', () => {
  it('labels today and tomorrow, weekday beyond', () => {
    const groups = groupByDay([
      ev({ id: 'a', startsAt: '2026-07-08T15:00:00' }),
      ev({ id: 'b', startsAt: '2026-07-09T09:00:00' }),
      ev({ id: 'c', startsAt: '2026-07-11T09:00:00' }),
    ], 7, NOW);
    expect(groups.map(g => g.label)).toEqual(['Today', 'Tomorrow', 'Saturday, Jul 11']);
  });

  it('drops events past the horizon', () => {
    const groups = groupByDay([ev({ startsAt: '2026-08-20T10:00:00' })], 7, NOW);
    expect(groups).toEqual([]);
  });

  it('parses all-day YYYY-MM-DD as a LOCAL date (no UTC drift)', () => {
    const groups = groupByDay([ev({ allDay: true, startsAt: '2026-07-09' })], 7, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Tomorrow');
  });

  it('shows an already-running multi-day event under today', () => {
    const groups = groupByDay([ev({ allDay: true, startsAt: '2026-07-06', endsAt: '2026-07-10' })], 7, NOW);
    expect(groups[0].label).toBe('Today');
  });

  it('sorts all-day first within a day, then by time', () => {
    const groups = groupByDay([
      ev({ id: 'timed', startsAt: '2026-07-08T09:00:00' }),
      ev({ id: 'allday', allDay: true, startsAt: '2026-07-08' }),
    ], 7, NOW);
    expect(groups[0].events.map(e => e.id)).toEqual(['allday', 'timed']);
  });
});

describe('groupByPerson', () => {
  it('buckets by calendar label in household order (Family, Tim, Caroline)', () => {
    const groups = groupByPerson([
      ev({ id: 'c', calendar: 'Caroline', startsAt: '2026-07-09T09:00:00' }),
      ev({ id: 't', calendar: 'Tim', startsAt: '2026-07-10T09:00:00' }),
      ev({ id: 'f', calendar: 'Family', startsAt: '2026-07-08T09:00:00' }),
    ], 7, NOW);
    expect(groups.map(g => g.person)).toEqual(['Family', 'Tim', 'Caroline']);
  });

  it('sorts each person chronologically, all-day leading its day', () => {
    const groups = groupByPerson([
      ev({ id: 'later', startsAt: '2026-07-09T15:00:00' }),
      ev({ id: 'allday', allDay: true, startsAt: '2026-07-09' }),
      ev({ id: 'sooner', startsAt: '2026-07-08T09:00:00' }),
    ], 7, NOW);
    expect(groups[0].events.map(e => e.id)).toEqual(['sooner', 'allday', 'later']);
  });

  it('caps each person independently', () => {
    const events = Array.from({ length: 14 }, (_, i) => ev({
      id: `f${i}`, calendar: 'Family', startsAt: `2026-07-${String(8 + i).padStart(2, '0')}T09:00:00`,
    }));
    const groups = groupByPerson(events, 90, NOW, 10);
    expect(groups[0].events).toHaveLength(10);
  });

  it('drops events past the horizon and unknown labels sort last', () => {
    const groups = groupByPerson([
      ev({ id: 'far', startsAt: '2026-08-20T10:00:00' }),
      ev({ id: 'z', calendar: 'Zoe', startsAt: '2026-07-09T09:00:00' }),
      ev({ id: 't', calendar: 'Tim', startsAt: '2026-07-09T10:00:00' }),
    ], 7, NOW);
    expect(groups.map(g => g.person)).toEqual(['Tim', 'Zoe']);
  });

  it('merges work + personal calendars into one person section via `person`', () => {
    const groups = groupByPerson([
      ev({ id: 'w', calendar: 'Tim (Work)', person: 'Tim', kind: 'work', startsAt: '2026-07-09T09:00:00' }),
      ev({ id: 'p', calendar: 'Tim', startsAt: '2026-07-08T10:00:00' }),
    ], 7, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].person).toBe('Tim');
    expect(groups[0].events.map(e => e.id)).toEqual(['p', 'w']);
  });
});

describe('splitByHorizon', () => {
  it('splits at the horizon, later sorted soonest-first', () => {
    const { within, later } = splitByHorizon([
      ev({ id: 'far2', startsAt: '2026-09-01T10:00:00' }),
      ev({ id: 'near', startsAt: '2026-07-09T10:00:00' }),
      ev({ id: 'far1', startsAt: '2026-08-01T10:00:00' }),
    ], 7, NOW);
    expect(within.map(e => e.id)).toEqual(['near']);
    expect(later.map(e => e.id)).toEqual(['far1', 'far2']);
  });
});

describe('renderCalendarOverlay', () => {
  it('groups by person by default: person labels, day column, no chips', () => {
    const html = renderCalendarOverlay(getMockUpcoming(NOW), { days: 7, now: NOW });
    expect(html).toContain('cal-person--family');
    expect(html).toContain('cal-event__day');
    expect(html).toContain('Pediatrician — Mabel 2mo');
    expect(html).not.toContain('cal-chip--family'); // section header names the person
  });

  it('renders the production title, subtitle, and ten-per-person cap', () => {
    const events = Array.from({ length: 12 }, (_, i) => ev({
      id: `f${i}`, title: `Family ${i}`, startsAt: `2026-07-${String(8 + i).padStart(2, '0')}T09:00:00`,
    }));
    const html = renderCalendarOverlay(events, { days: 90, perPerson: 10, now: NOW });
    expect(html).toContain('What&#39;s ahead');
    expect(html).toContain('Next 10 events per person'); // subtitle
    expect(html.match(/cal-event--dated/g)).toHaveLength(10);
  });

  it('always renders the full household roster in person mode', () => {
    // Family-only data → Tim and Caroline still get sections.
    const html = renderCalendarOverlay([ev({ id: 'f1' })], { days: 7, now: NOW });
    expect(html).toContain('cal-person--family');
    expect(html).toContain('cal-person--tim');
    expect(html).toContain('cal-person--caroline');
  });

  it('distinguishes "not linked" from "linked but quiet"', () => {
    const events = [
      ev({ id: 'f1' }), // Family, within horizon
      ev({ id: 't1', calendar: 'Tim', startsAt: '2026-09-01T10:00:00' }), // Tim, beyond horizon
    ];
    const html = renderCalendarOverlay(events, { days: 7, now: NOW });
    // Tim exists in the data → quiet week; Caroline appears nowhere → unlinked.
    expect(html).toContain('Nothing coming up.');
    expect(html).toContain('Not linked yet');
  });

  it('a work calendar links its PERSON: Caroline (Work) events mark Caroline linked', () => {
    const events = [
      ev({ id: 'cw', calendar: 'Caroline (Work)', person: 'Caroline', kind: 'work', startsAt: '2026-09-01T10:00:00' }),
      ev({ id: 'f1' }),
      ev({ id: 't1', calendar: 'Tim', startsAt: '2026-07-09T10:00:00' }),
    ];
    const html = renderCalendarOverlay(events, { days: 7, now: NOW });
    // Her only event is beyond the horizon → quiet week, NOT unlinked.
    expect(html).not.toContain('Not linked yet');
  });

  it('tags work-calendar rows with the Work pill', () => {
    const html = renderCalendarOverlay([
      ev({ id: 'w', calendar: 'Tim (Work)', person: 'Tim', kind: 'work', title: 'Product review' }),
    ], { days: 7, now: NOW });
    expect(html).toContain('cal-tag--work');
    expect(html).toContain('cal-person--tim'); // grouped under Tim, not "Tim (Work)"
  });

  it('empty-week Coming-up chips carry the person name and hue for work events', () => {
    const html = renderCalendarOverlay([
      ev({ id: 'w', calendar: 'Tim (Work)', person: 'Tim', kind: 'work', startsAt: '2026-08-01T10:00:00' }),
    ], { days: 7, now: NOW });
    expect(html).toContain('cal-chip--tim'); // person hue, not colorless tim-work
    expect(html).not.toContain('cal-chip--tim-work');
  });

  it('shows an event-count badge only for sections with events', () => {
    const html = renderCalendarOverlay(
      [ev({ id: 'f1' }), ev({ id: 'f2', startsAt: '2026-07-09T10:00:00' })],
      { days: 7, now: NOW },
    );
    expect(html.match(/cal-person__count/g)).toHaveLength(1);
    expect(html).toContain('<span class="cal-person__count">2</span>');
  });

  it('groupBy day keeps the original day-bucketed view with chips', () => {
    const html = renderCalendarOverlay(getMockUpcoming(NOW), { days: 7, now: NOW, groupBy: 'day' });
    expect(html).toContain('Today');
    expect(html).toContain('All day');
    expect(html).toContain('cal-chip--family');
  });

  it('renders an empty state', () => {
    const html = renderCalendarOverlay([], { days: 7, now: NOW });
    expect(html).toContain('Nothing scheduled');
    expect(html).not.toContain('Coming up');
  });

  it('fills an empty week with Coming up, capped at 12', () => {
    const later = Array.from({ length: 15 }, (_, i) =>
      ev({ id: `l${i}`, title: `Later ${i}`, startsAt: `2026-07-${20 + (i % 9)}T10:00:00` }));
    const html = renderCalendarOverlay(later, { days: 7, now: NOW });
    expect(html).toContain('Nothing scheduled');
    expect(html).toContain('Coming up');
    expect(html.match(/cal-event--dated/g)).toHaveLength(12);
    expect(html).toContain('cal-chip--family'); // chip matters when sections don't name the person
  });

  it('escapes HTML in titles', () => {
    const html = renderCalendarOverlay([ev({ title: '<img src=x>' })], { days: 7, now: new Date('2026-07-08T08:00:00') });
    expect(html).not.toContain('<img src=x>');
  });
});

describe('openCalendarOverlay', () => {
  it('mounts, locks scroll, and closes on the ✕', () => {
    const close = openCalendarOverlay({ initial: getMockUpcoming(NOW), live: Promise.resolve(null) });
    expect(document.querySelector('.overlay')).not.toBeNull();
    expect(document.documentElement.classList.contains('has-overlay')).toBe(true);
    document.querySelector('[data-action="close"]').click();
    expect(document.querySelector('.overlay')).toBeNull();
    expect(document.documentElement.classList.contains('has-overlay')).toBe(false);
    close(); // idempotent
  });

  it('closes on Escape', () => {
    openCalendarOverlay({ initial: [], live: Promise.resolve(null) });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.overlay')).toBeNull();
  });
});

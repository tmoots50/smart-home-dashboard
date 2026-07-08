import { describe, it, expect } from 'vitest';
import { renderCalendarOverlay, groupByDay, openCalendarOverlay } from './calendar-overlay.js';
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

describe('renderCalendarOverlay', () => {
  it('renders day groups with events, chips, and All day rows', () => {
    const html = renderCalendarOverlay(getMockUpcoming(NOW), { days: 7, now: NOW });
    expect(html).toContain('Today');
    expect(html).toContain('All day');
    expect(html).toContain('cal-chip--family');
    expect(html).toContain('Pediatrician — Mabel 2mo');
  });

  it('renders an empty state', () => {
    const html = renderCalendarOverlay([], { days: 7, now: NOW });
    expect(html).toContain('Nothing scheduled');
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

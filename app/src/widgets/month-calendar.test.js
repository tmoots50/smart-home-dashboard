import { describe, it, expect, afterEach, vi } from 'vitest';
import { buildMonthGrid, renderMonthCalendar, openMonthCalendar } from './month-calendar.js';

// July 2026: the 1st is a Wednesday (getDay 3), 31 days → ceil(34/7)=5 weeks.
const YEAR = 2026;
const JULY = 6;
const NOW = new Date('2026-07-10T08:00:00');

const ev = (over) => ({
  id: 'x', calendar: 'Family', title: 'Event', sub: '', description: '',
  startsAt: '2026-07-10T15:00:00', endsAt: '2026-07-10T16:00:00', allDay: false, ...over,
});

afterEach(() => {
  document.querySelectorAll('.overlay').forEach(el => el.remove());
  document.documentElement.classList.remove('has-overlay');
});

describe('buildMonthGrid', () => {
  it('covers whole weeks: July 2026 = 35 cells, leading/trailing outside', () => {
    const { cells } = buildMonthGrid(YEAR, JULY, [], NOW);
    expect(cells).toHaveLength(35);
    expect(cells.slice(0, 3).every(c => c.outside)).toBe(true);  // Jun 28-30
    expect(cells[3].outside).toBe(false);                        // Jul 1
    expect(cells[34].outside).toBe(true);                        // Aug 1
  });

  it('marks exactly one today when now is in the month, none otherwise', () => {
    const inMonth = buildMonthGrid(YEAR, JULY, [], NOW);
    expect(inMonth.cells.filter(c => c.today)).toHaveLength(1);
    expect(inMonth.cells.find(c => c.today).date).toBe('2026-07-10');
    const otherMonth = buildMonthGrid(YEAR, 8, [], NOW);
    expect(otherMonth.cells.filter(c => c.today)).toHaveLength(0);
  });

  it('buckets all-day YYYY-MM-DD onto the local day (no UTC drift)', () => {
    const { cells } = buildMonthGrid(YEAR, JULY, [ev({ allDay: true, startsAt: '2026-07-09', endsAt: '2026-07-10' })], NOW);
    expect(cells.find(c => c.date === '2026-07-09').events).toHaveLength(1);
    expect(cells.find(c => c.date === '2026-07-08').events).toHaveLength(0);
  });

  it('clamps an event already running at month start onto day 1', () => {
    const { cells } = buildMonthGrid(YEAR, JULY, [
      ev({ allDay: true, startsAt: '2026-06-27', endsAt: '2026-07-03' }),
    ], NOW);
    expect(cells.find(c => c.date === '2026-07-01').events).toHaveLength(1);
  });

  it('drops events that ended before the month began', () => {
    const { cells } = buildMonthGrid(YEAR, JULY, [
      ev({ allDay: true, startsAt: '2026-06-20', endsAt: '2026-06-25' }),
    ], NOW);
    expect(cells.every(c => c.events.length === 0)).toBe(true);
  });

  it('caps chips at 3 and counts the rest', () => {
    const events = Array.from({ length: 6 }, (_, i) =>
      ev({ id: `e${i}`, startsAt: `2026-07-10T0${i + 1}:00:00` }));
    const { cells } = buildMonthGrid(YEAR, JULY, events, NOW);
    const day = cells.find(c => c.date === '2026-07-10');
    expect(day.chips).toHaveLength(3);
    expect(day.moreCount).toBe(3);
  });

  it('sorts all-day first within a day', () => {
    const { cells } = buildMonthGrid(YEAR, JULY, [
      ev({ id: 'timed', startsAt: '2026-07-10T09:00:00' }),
      ev({ id: 'allday', allDay: true, startsAt: '2026-07-10', endsAt: '2026-07-11' }),
    ], NOW);
    expect(cells.find(c => c.date === '2026-07-10').events.map(e => e.id)).toEqual(['allday', 'timed']);
  });
});

describe('renderMonthCalendar', () => {
  it('renders the month title, dow header, and colored chips', () => {
    const html = renderMonthCalendar([ev({ calendar: 'Tim' })], { year: YEAR, month: JULY, now: NOW });
    expect(html).toContain('July 2026');
    expect(html).toContain('<span>Sun</span>');
    expect(html).toContain('month-cal__chip--tim');
    expect(html).toContain('is-today');
  });

  it('escapes HTML in titles', () => {
    const html = renderMonthCalendar([ev({ title: '<img src=x>' })], { year: YEAR, month: JULY, now: NOW });
    expect(html).not.toContain('<img src=x>');
  });

  it('renders a compact chip time for timed events, none for all-day', () => {
    const html = renderMonthCalendar([
      ev({ id: 't', startsAt: '2026-07-10T19:30:00' }),
      ev({ id: 'a', allDay: true, startsAt: '2026-07-11', endsAt: '2026-07-12', title: 'AllDayThing' }),
    ], { year: YEAR, month: JULY, now: NOW });
    expect(html).toContain('7:30p');
    expect(html).toMatch(/AllDayThing/);
  });

  it('work events chip in the person hue with the is-work marker', () => {
    const html = renderMonthCalendar([
      ev({ calendar: 'Tim (Work)', person: 'Tim', kind: 'work' }),
    ], { year: YEAR, month: JULY, now: NOW });
    expect(html).toContain('month-cal__chip--tim is-work');
    expect(html).not.toContain('month-cal__chip--tim-work');
    // The legend stays the household three — no separate work entry.
    expect(html).not.toContain('legend-item--tim-work');
  });

  it('the person filter covers that person\'s work AND personal calendars', () => {
    const events = [
      ev({ id: 'w', calendar: 'Tim (Work)', person: 'Tim', kind: 'work' }),
      ev({ id: 'p', calendar: 'Tim', title: 'Personal thing' }),
      ev({ id: 'f', calendar: 'Family' }),
    ];
    const html = renderMonthCalendar(events, { year: YEAR, month: JULY, now: NOW, filter: 'tim' });
    expect((html.match(/month-cal__chip--tim/g) || [])).toHaveLength(2); // work + personal
    expect(html).not.toContain('month-cal__chip--family');
  });
});

describe('openMonthCalendar', () => {
  const stubSource = (months = {}) => ({
    getMonth: vi.fn((y, m) => ({ initial: months[`${y}-${m}`] ?? [], live: Promise.resolve(null) })),
  });

  it('mounts on the current month, locks scroll, closes on ✕ and Escape', () => {
    const source = stubSource();
    const close = openMonthCalendar(source, { now: NOW });
    expect(document.querySelector('.month-cal')).not.toBeNull();
    expect(document.querySelector('[data-month-title]').textContent).toBe('July 2026');
    expect(document.documentElement.classList.contains('has-overlay')).toBe(true);
    expect(source.getMonth).toHaveBeenCalledWith(2026, 6);

    document.querySelector('[data-action="close"]').click();
    expect(document.querySelector('.month-cal')).toBeNull();
    expect(document.documentElement.classList.contains('has-overlay')).toBe(false);
    close(); // idempotent

    openMonthCalendar(source, { now: NOW });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.month-cal')).toBeNull();
  });

  it('navigates months and clamps at ±12', () => {
    const source = stubSource();
    openMonthCalendar(source, { now: NOW });
    document.querySelector('[data-action="next"]').click();
    expect(document.querySelector('[data-month-title]').textContent).toBe('August 2026');
    document.querySelector('[data-action="prev"]').click();
    document.querySelector('[data-action="prev"]').click();
    expect(document.querySelector('[data-month-title]').textContent).toBe('June 2026');

    for (let i = 0; i < 20; i++) document.querySelector('[data-action="next"]').click();
    // June 2026 + 13 allowed clicks lands on July 2027 (now +12); further clicks no-op.
    expect(document.querySelector('[data-month-title]').textContent).toBe('July 2027');
  });

  it('opens the day-detail sheet from "+N more" and event detail from a chip', () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      ev({ id: `e${i}`, title: `Busy ${i}`, startsAt: `2026-07-10T0${i + 1}:00:00` }));
    openMonthCalendar(stubSource({ '2026-6': events }), { now: NOW });

    document.querySelector('.month-cal__more').click();
    const sheet = document.querySelector('.overlay--day-detail');
    expect(sheet).not.toBeNull();
    expect(sheet.querySelectorAll('.cal-event')).toHaveLength(5);

    sheet.querySelector('.cal-event').click();
    expect(document.querySelector('.event-detail')).not.toBeNull();
  });
});

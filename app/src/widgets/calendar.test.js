import { describe, it, expect } from 'vitest';
import { renderCalendar, renderWeek } from './calendar.js';
import { getMockCalendar } from '../lib/calendar-mock.js';

// data-event JSON is HTML-escaped into the attribute; mirror that here.
const escapeAttr = (s) => s.replace(/"/g, '&quot;');

describe('renderCalendar', () => {
  it('renders the Family column only — Tim and Caroline are hidden everywhere', () => {
    const NOW = new Date('2026-04-29T07:00:00');
    const html = renderCalendar(getMockCalendar(NOW), NOW); // mock carries all three
    expect(html).toContain('calendar__column--family');
    expect(html).not.toContain('calendar__column--tim');
    expect(html).not.toContain('calendar__column--caroline');
    // Their names never appear — not as a label, not inside a data-event blob.
    expect(html).not.toContain('Tim');
    expect(html).not.toContain('Caroline');
    // Family's own events still render.
    expect(html).toContain('Pediatrician — Mabel 1mo');
  });

  it('drops hidden people\'s sections and events entirely (no placeholder column)', () => {
    const NOW = new Date('2026-04-29T08:00:00');
    const start = new Date(NOW.getTime() + 30 * 60_000).toISOString();
    const html = renderCalendar({
      sections: [
        { label: 'Family', events: [{ id: 'f', startsAt: start, title: 'Dinner at home', sub: '' }] },
        { label: 'Tim', events: [{ id: 't', startsAt: start, title: 'Recruiter call', sub: '' }] },
        { label: 'Caroline', events: [{ id: 'c', startsAt: start, title: 'Team standup', sub: '' }] },
      ],
      nextEventId: 'f',
    }, NOW);
    // Exactly one column, no "Not linked yet" for the vanished people.
    expect((html.match(/calendar__column--/g) || [])).toHaveLength(1);
    expect(html).toContain('Dinner at home');
    expect(html).not.toContain('Recruiter call');
    expect(html).not.toContain('Team standup');
    expect(html).not.toContain('Not linked yet');
  });

  it('shows "Nothing scheduled." for an empty Family column', () => {
    const NOW = new Date('2026-04-29T08:00:00');
    const html = renderCalendar({ sections: [{ label: 'Family', events: [] }], nextEventId: null }, NOW);
    expect(html).toContain('Nothing scheduled');
  });

  it('shows "Not linked yet" when the Family section is missing', () => {
    const NOW = new Date('2026-04-29T08:00:00');
    const html = renderCalendar({ sections: [], nextEventId: null }, NOW);
    const unlinked = html.match(/Not linked yet/g) || [];
    expect(unlinked.length).toBe(1); // only the Family column exists to be unlinked
  });

  it('renders future events across days', () => {
    const NOW = new Date('2026-04-29T08:00:00');
    const laterToday = new Date('2026-04-29T20:00:00').toISOString();
    const tomorrow = new Date('2026-04-30T09:00:00').toISOString();
    const html = renderCalendar({
      sections: [{
        label: 'Family',
        events: [
          { id: 'a', startsAt: laterToday, title: 'Later today', sub: '' },
          { id: 'b', startsAt: tomorrow, title: 'Tomorrow morning', sub: '' },
        ],
      }],
      nextEventId: 'a',
    }, NOW);
    expect(html).toContain('Later today');
    expect(html).toContain('Tomorrow morning');
    expect(html).toContain('Tomorrow');
  });

  it('marks the next-up event with the highlight class', () => {
    const NOW = new Date('2026-04-29T07:00:00');
    const data = getMockCalendar(NOW); // soonest upcoming is a Family event (08:30)
    const html = renderCalendar(data, NOW);
    expect(html).toContain('calendar__event--next');
  });

  it('caps the Family column at 7 events', () => {
    const NOW = new Date('2026-04-29T07:00:00');
    const events = Array.from({ length: 9 }, (_, i) => ({
      id: `e-${i}`, startsAt: new Date(NOW.getTime() + (i + 1) * 60_000).toISOString(), title: `Family Event ${i}`, sub: '',
    }));
    const html = renderCalendar({ sections: [{ label: 'Family', events }] }, NOW);
    expect((html.match(/class="calendar__event/g) || [])).toHaveLength(7);
    expect(html).not.toContain('Family Event 7');
    expect(html).not.toContain('Family Event 8');
  });

  it('a hidden person\'s events never consume Family\'s slots', () => {
    const NOW = new Date('2026-04-29T07:00:00');
    const familyEvents = Array.from({ length: 5 }, (_, i) => ({
      id: `f-${i}`, startsAt: new Date(NOW.getTime() + (i + 1) * 60_000).toISOString(), title: `Family Event ${i}`, sub: '',
    }));
    const timEvents = Array.from({ length: 8 }, (_, i) => ({
      id: `t-${i}`, startsAt: new Date(NOW.getTime() + (i + 1) * 60_000).toISOString(), title: `Tim Event ${i}`, sub: '',
    }));
    const html = renderCalendar({ sections: [
      { label: 'Family', events: familyEvents },
      { label: 'Tim', events: timEvents },
    ] }, NOW);
    expect((html.match(/class="calendar__event/g) || [])).toHaveLength(5); // all Family, no Tim
    expect(html).not.toContain('Tim Event');
  });

  it('still renders the Family label when nothing is scheduled', () => {
    const NOW = new Date('2026-04-29T23:30:00');
    const html = renderCalendar(getMockCalendar(NOW), NOW); // every mock event is in the past
    expect(html).toContain('calendar__column--family');
    expect(html).not.toContain('Tim');
    expect(html).not.toContain('Caroline');
    const placeholders = html.match(/Nothing scheduled/g) || [];
    expect(placeholders.length).toBe(1);
    expect(html).not.toContain('Not linked yet');
  });

  it('days flavor hides Tim/Caroline dots and shows a Family-only legend', () => {
    const NOW = new Date('2026-04-29T07:00:00');
    const html = renderCalendar(getMockCalendar(NOW), NOW, { flavor: 'days' });
    expect((html.match(/calendar__legend-item/g) || [])).toHaveLength(1); // Family only
    expect(html).not.toContain('calendar__dot--tim');
    expect(html).not.toContain('calendar__dot--caroline');
    expect(html).not.toContain('Tim');
    expect(html).not.toContain('Caroline');
  });

  it('escapes HTML in event titles', () => {
    const NOW = new Date('2026-04-29T07:00:00');
    const start = new Date(NOW.getTime() + 30 * 60_000).toISOString();
    const html = renderCalendar({
      sections: [{
        label: 'Family',
        events: [{ id: 'x', startsAt: start, title: '<img onerror=1>', sub: '' }],
      }],
      nextEventId: 'x',
    }, NOW);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('preserves the true source calendar in data-event for visible rows', () => {
    const NOW = new Date('2026-04-29T07:00:00');
    const start = new Date(NOW.getTime() + 30 * 60_000).toISOString();
    const html = renderCalendar({
      sections: [{ label: 'Family', events: [{ id: 'f', startsAt: start, title: 'Dinner', sub: '' }] }],
      nextEventId: 'f',
    }, NOW);
    expect(html).toContain(escapeAttr('"calendar":"Family"'));
  });
});

describe('renderWeek (5-day rolling window)', () => {
  const NOW = new Date('2026-04-29T07:00:00'); // Wed

  // A timed event on `offsetDays` from NOW, sh:sm → eh:em local.
  const ev = (id, offsetDays, sh, sm, eh, em, title, extra = {}) => {
    const s = new Date(NOW); s.setDate(s.getDate() + offsetDays); s.setHours(sh, sm, 0, 0);
    const e = new Date(NOW); e.setDate(e.getDate() + offsetDays); e.setHours(eh, em, 0, 0);
    return { id, startsAt: s.toISOString(), endsAt: e.toISOString(), title, ...extra };
  };

  it('renders five day columns and an hour gutter', () => {
    const html = renderWeek([], NOW);
    expect((html.match(/calweek__col/g) || [])).toHaveLength(5);
    expect(html).toContain('calweek__gutter');
    expect(html).toContain('calendar--week');
  });

  it('windows off today with offsetDays, dropping events outside the visible window', () => {
    const todayEv = ev('b', 0, 9, 0, 10, 0, 'Today event');
    const nextWindowEv = ev('a', 6, 9, 0, 10, 0, 'Next-window event'); // day 6 → in the +5 window (days 5..9)
    const html = renderWeek([todayEv, nextWindowEv], NOW, { offsetDays: 5 });
    expect(html).toContain('Next-window event');
    expect(html).not.toContain('Today event');
  });

  it('shows the now-line only when today is inside the visible window', () => {
    expect((renderWeek([], NOW, { offsetDays: 0 }).match(/class="calweek__now"/g) || [])).toHaveLength(1);
    expect(renderWeek([], NOW, { offsetDays: 5 })).not.toContain('calweek__now'); // today paged out
  });

  it('renders ‹ › nav buttons and a date-range Today control', () => {
    const html = renderWeek([], NOW);
    expect(html).toContain('data-calnav="prev"');
    expect(html).toContain('data-calnav="next"');
    expect(html).toContain('data-calnav="today"');
  });

  it('accents the range label (is-away) only when paged off today', () => {
    expect(renderWeek([], NOW, { offsetDays: 0 })).not.toContain('is-away');
    expect(renderWeek([], NOW, { offsetDays: 5 })).toContain('is-away');
  });

  it('disables prev at the earliest window and next at the latest', () => {
    const earliest = renderWeek([], NOW, { offsetDays: -5 }); // WEEK_MIN_OFFSET
    expect(earliest).toMatch(/data-calnav="prev"[^>]*disabled/);
    expect(earliest).not.toMatch(/data-calnav="next"[^>]*disabled/);
    const latest = renderWeek([], NOW, { offsetDays: 25 }); // WEEK_MAX_OFFSET
    expect(latest).toMatch(/data-calnav="next"[^>]*disabled/);
    expect(latest).not.toMatch(/data-calnav="prev"[^>]*disabled/);
  });

  it('draws a timed event as a positioned block carrying data-event', () => {
    const html = renderWeek([ev('a', 0, 9, 0, 10, 0, 'Grocery Run')], NOW);
    expect(html).toContain('calweek__event');
    expect(html).toContain('Grocery Run');
    expect(html).toContain('data-event=');
    expect(html).toMatch(/top:[\d.]+%;height:[\d.]+%/); // proportional placement
  });

  // The card's fixed height forces sub-44px blocks; keeping them out of the
  // button/role=button audit selector is what lets the QA tap floor pass.
  it('blocks are not buttons and expose no role=button', () => {
    const html = renderWeek([ev('a', 0, 9, 0, 10, 0, 'X')], NOW);
    expect(html).not.toContain('role="button"');
    expect(html).not.toMatch(/<button[^>]*calweek__event/);
  });

  it('splits overlapping events into side-by-side lanes', () => {
    const html = renderWeek([
      ev('a', 0, 9, 0, 11, 0, 'A'),
      ev('b', 0, 10, 0, 12, 0, 'B'), // overlaps A
    ], NOW);
    expect(html).toContain('width:50.00%');
  });

  it('gives a non-overlapping run the full column width back', () => {
    const html = renderWeek([
      ev('a', 0, 9, 0, 10, 0, 'A'),
      ev('b', 0, 11, 0, 12, 0, 'B'), // after A → same lane cluster resets
    ], NOW);
    expect(html).toContain('width:100.00%');
    expect(html).not.toContain('width:50.00%');
  });

  it('places all-day events as a spanning bar in the pinned band', () => {
    const html = renderWeek([
      { id: 'c', title: 'Camping Trip', allDay: true, startsAt: '2026-04-29', endsAt: '2026-05-01' }, // Wed..Thu
    ], NOW);
    expect(html).toContain('calweek__allday');
    expect(html).toContain('Camping Trip');
    expect(html).toContain('grid-column:2 / 4'); // gutter is col 1; day0..day1
  });

  it('omits the all-day band entirely when there are no all-day events', () => {
    const html = renderWeek([ev('a', 0, 9, 0, 10, 0, 'Timed only')], NOW);
    expect(html).not.toContain('calweek__allday');
  });

  it('hides Tim and Caroline events, like the other flavors', () => {
    const html = renderWeek([
      ev('f', 0, 9, 0, 10, 0, 'Family dinner', { person: 'Family' }),
      ev('t', 0, 9, 0, 10, 0, 'Recruiter call', { person: 'Tim' }),
      ev('c', 0, 9, 0, 10, 0, 'Standup', { person: 'Caroline (Work)' }),
    ], NOW);
    expect(html).toContain('Family dinner');
    expect(html).not.toContain('Recruiter call');
    expect(html).not.toContain('Standup');
  });

  it('marks the soonest upcoming event as next', () => {
    const html = renderWeek([
      ev('a', 0, 9, 0, 10, 0, 'Soonest'),
      ev('b', 1, 9, 0, 10, 0, 'Later'),
    ], NOW);
    expect((html.match(/calweek__event--next/g) || [])).toHaveLength(1);
  });

  it('clamps a duration-less event to a default block instead of crashing', () => {
    const s = new Date(NOW); s.setHours(9, 0, 0, 0);
    const html = renderWeek([{ id: 'a', startsAt: s.toISOString(), title: 'No end' }], NOW);
    expect(html).toContain('No end');
    expect(html).toContain('calweek__event');
  });

  it('escapes HTML in titles', () => {
    const html = renderWeek([ev('a', 0, 9, 0, 10, 0, '<img onerror=1>')], NOW);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});

import { describe, it, expect } from 'vitest';
import { renderCalendar } from './calendar.js';
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

import { describe, it, expect } from 'vitest';
import { renderCalendar } from './calendar.js';
import { getMockCalendar } from '../lib/calendar-mock.js';

describe('renderCalendar', () => {
  it('always renders all three column labels (Tim / Family / Caroline)', () => {
    const NOW = new Date('2026-04-29T07:00:00');
    const data = getMockCalendar(NOW);
    const html = renderCalendar(data, NOW);
    expect(html).toContain('Tim');
    expect(html).toContain('Family');
    expect(html).toContain('Caroline');
  });

  it('shows "Nothing scheduled." for a connected column with no events', () => {
    const NOW = new Date('2026-04-29T08:00:00');
    const start = new Date(NOW.getTime() + 30 * 60_000).toISOString();
    const html = renderCalendar({
      sections: [
        { label: 'Tim', events: [{ id: 'a', startsAt: start, title: 'Standup', sub: '' }] },
        { label: 'Family', events: [] },
      ],
      nextEventId: 'a',
    }, NOW);
    expect(html).toContain('Nothing scheduled');
  });

  it('shows "Not linked yet" for a column with no matching section (Caroline)', () => {
    const NOW = new Date('2026-04-29T08:00:00');
    const start = new Date(NOW.getTime() + 30 * 60_000).toISOString();
    const html = renderCalendar({
      sections: [
        { label: 'Tim', events: [{ id: 'a', startsAt: start, title: 'Standup', sub: '' }] },
      ],
      nextEventId: 'a',
    }, NOW);
    // Family and Caroline have no section → both render the unlinked placeholder.
    const unlinked = html.match(/Not linked yet/g) || [];
    expect(unlinked.length).toBe(2);
  });

  it('only renders events within the next 24 hours', () => {
    const NOW = new Date('2026-04-29T08:00:00');
    const inWindow = new Date(NOW.getTime() + 23 * 3_600_000).toISOString();
    const outOfWindow = new Date(NOW.getTime() + 25 * 3_600_000).toISOString();
    const html = renderCalendar({
      sections: [{
        label: 'Tim',
        events: [
          { id: 'a', startsAt: inWindow, title: 'Just inside window', sub: '' },
          { id: 'b', startsAt: outOfWindow, title: 'Just outside window', sub: '' },
        ],
      }],
      nextEventId: 'a',
    }, NOW);
    expect(html).toContain('Just inside window');
    expect(html).not.toContain('Just outside window');
  });

  it('marks the next-up event with the highlight class', () => {
    const NOW = new Date('2026-04-29T07:00:00');
    const data = getMockCalendar(NOW);
    const html = renderCalendar(data, NOW);
    expect(html).toContain('calendar__event--next');
  });

  it('still renders all column labels when nothing is scheduled', () => {
    const NOW = new Date('2026-04-29T23:30:00');
    const data = getMockCalendar(NOW);
    const html = renderCalendar(data, NOW);
    expect(html).toContain('Tim');
    expect(html).toContain('Family');
    expect(html).toContain('Caroline');
    // All three mock sections are connected but past → three "Nothing scheduled."
    const placeholders = html.match(/Nothing scheduled/g) || [];
    expect(placeholders.length).toBe(3);
  });

  it('escapes HTML in event titles', () => {
    const NOW = new Date('2026-04-29T07:00:00');
    const start = new Date(NOW.getTime() + 30 * 60_000).toISOString();
    const html = renderCalendar({
      sections: [{
        label: 'Tim',
        events: [{ id: 'x', startsAt: start, title: '<img onerror=1>', sub: '' }],
      }],
      nextEventId: 'x',
    }, NOW);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});

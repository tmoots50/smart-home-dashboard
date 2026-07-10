import { describe, it, expect } from 'vitest';
import { renderCalendar } from './calendar.js';
import { getMockCalendar } from '../lib/calendar-mock.js';

describe('renderCalendar', () => {
  it('always renders all three labels with Family first', () => {
    const NOW = new Date('2026-04-29T07:00:00');
    const data = getMockCalendar(NOW);
    const html = renderCalendar(data, NOW);
    expect(html).toContain('Tim');
    expect(html).toContain('Family');
    expect(html).toContain('Caroline');
    expect(html.indexOf('Family')).toBeLessThan(html.indexOf('Tim'));
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

  it('renders future events across days', () => {
    const NOW = new Date('2026-04-29T08:00:00');
    const laterToday = new Date('2026-04-29T20:00:00').toISOString();
    const tomorrow = new Date('2026-04-30T09:00:00').toISOString();
    const html = renderCalendar({
      sections: [{
        label: 'Tim',
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
    const data = getMockCalendar(NOW);
    const html = renderCalendar(data, NOW);
    expect(html).toContain('calendar__event--next');
  });

  it('shows at most the next 10 events across all columns', () => {
    const NOW = new Date('2026-04-29T07:00:00');
    const events = Array.from({ length: 8 }, (_, i) => ({
      id: `e-${i}`, startsAt: new Date(NOW.getTime() + (i + 1) * 60_000).toISOString(), title: `Event ${i}`, sub: '',
    }));
    const html = renderCalendar({ sections: [
      { label: 'Family', events },
      { label: 'Tim', events: events.map((e, i) => ({ ...e, id: `t-${i}`, startsAt: new Date(NOW.getTime() + (i + 1) * 60_000 + 30_000).toISOString() })) },
    ] }, NOW);
    expect((html.match(/class="calendar__event/g) || [])).toHaveLength(10);
  });

  it('still renders all column labels when nothing is scheduled', () => {
    const NOW = new Date('2026-04-29T23:30:00');
    const data = getMockCalendar(NOW);
    const html = renderCalendar(data, NOW);
    expect(html).toContain('Tim');
    expect(html).toContain('Family');
    expect(html).toContain('Caroline');
    // Family + Tim are connected but past; Caroline is intentionally unlinked.
    const placeholders = html.match(/Nothing scheduled/g) || [];
    expect(placeholders.length).toBe(2);
    expect(html).toContain('Not linked yet');
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

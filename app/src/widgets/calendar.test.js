import { describe, it, expect } from 'vitest';
import { renderCalendar } from './calendar.js';
import { getMockCalendar } from '../lib/calendar-mock.js';

describe('renderCalendar', () => {
  it('always renders all section labels even when a section is empty', () => {
    const NOW = new Date('2026-04-29T08:00:00');
    const data = getMockCalendar(NOW);
    const html = renderCalendar(data, NOW);
    expect(html).toContain('Family');
    expect(html).toContain('Tim (Work)');
    expect(html).toContain('Caroline (Work)');
  });

  it('shows placeholder text in empty sections', () => {
    const NOW = new Date('2026-04-29T08:00:00');
    const start = new Date(NOW.getTime() + 30 * 60_000).toISOString();
    const html = renderCalendar({
      sections: [
        { label: 'Family', events: [{ id: 'a', startsAt: start, title: 'Standup', sub: '' }] },
        { label: 'Tim (Work)', events: [] },
      ],
      nextEventId: 'a',
    }, NOW);
    expect(html).toContain('Nothing scheduled');
  });

  it('only renders events within the next 24 hours', () => {
    const NOW = new Date('2026-04-29T08:00:00');
    const inWindow = new Date(NOW.getTime() + 23 * 3_600_000).toISOString();
    const outOfWindow = new Date(NOW.getTime() + 25 * 3_600_000).toISOString();
    const html = renderCalendar({
      sections: [{
        label: 'Family',
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

  it('still renders all section labels when nothing is scheduled', () => {
    const NOW = new Date('2026-04-29T22:00:00');
    const data = getMockCalendar(NOW);
    const html = renderCalendar(data, NOW);
    expect(html).toContain('Family');
    expect(html).toContain('Tim (Work)');
    expect(html).toContain('Caroline (Work)');
    const placeholders = html.match(/Nothing scheduled/g) || [];
    expect(placeholders.length).toBe(3);
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
});

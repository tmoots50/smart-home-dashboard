import { describe, it, expect } from 'vitest';
import { renderCalendar } from './calendar.js';
import { getMockCalendar } from '../lib/calendar-mock.js';

// data-event JSON is HTML-escaped into the attribute; mirror that here.
const escapeAttr = (s) => s.replace(/"/g, '&quot;');

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

  it('caps each column at 6 events', () => {
    const NOW = new Date('2026-04-29T07:00:00');
    const events = Array.from({ length: 8 }, (_, i) => ({
      id: `e-${i}`, startsAt: new Date(NOW.getTime() + (i + 1) * 60_000).toISOString(), title: `Family Event ${i}`, sub: '',
    }));
    const html = renderCalendar({ sections: [{ label: 'Family', events }] }, NOW);
    expect((html.match(/class="calendar__event/g) || [])).toHaveLength(6);
    expect(html).not.toContain('Family Event 6');
    expect(html).not.toContain('Family Event 7');
  });

  it('columns fill independently — a packed column never starves another', () => {
    const NOW = new Date('2026-04-29T07:00:00');
    const familyEvents = Array.from({ length: 8 }, (_, i) => ({
      id: `f-${i}`, startsAt: new Date(NOW.getTime() + (i + 1) * 60_000).toISOString(), title: `Family Event ${i}`, sub: '',
    }));
    const timEvents = Array.from({ length: 3 }, (_, i) => ({
      // Tim's events start hours after all of Family's — under the old global
      // top-10 they'd be evicted entirely.
      id: `t-${i}`, startsAt: new Date(NOW.getTime() + (i + 10) * 3_600_000).toISOString(), title: `Tim Event ${i}`, sub: '',
    }));
    const html = renderCalendar({ sections: [
      { label: 'Family', events: familyEvents },
      { label: 'Tim', events: timEvents },
    ] }, NOW);
    expect((html.match(/class="calendar__event/g) || [])).toHaveLength(9); // 6 + 3
    expect(html).toContain('Tim Event 0');
    expect(html).toContain('Tim Event 2');
  });

  it('still renders all column labels when nothing is scheduled', () => {
    const NOW = new Date('2026-04-29T23:30:00');
    const data = getMockCalendar(NOW);
    const html = renderCalendar(data, NOW);
    expect(html).toContain('Tim');
    expect(html).toContain('Family');
    expect(html).toContain('Caroline');
    // All three people are connected in the multi-source mock; every event is
    // in the past at 23:30 → three quiet columns, no unlinked placeholder.
    const placeholders = html.match(/Nothing scheduled/g) || [];
    expect(placeholders.length).toBe(3);
    expect(html).not.toContain('Not linked yet');
  });

  it('tags work-calendar events and interleaves them into the person column', () => {
    const NOW = new Date('2026-04-29T07:00:00');
    const html = renderCalendar(getMockCalendar(NOW), NOW);
    // Mock Tim column: personal 14:15 → work 15:00 → personal 16:00.
    expect(html).toContain('cal-tag--work');
    const tim = html.split('calendar__column--tim')[1].split('calendar__column--caroline')[0];
    const order = ['Job-search standup', 'Product review — Track', 'Recruiter call — Tessa']
      .map(t => tim.indexOf(t));
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('preserves the true source calendar in data-event (person-keyed sections)', () => {
    const NOW = new Date('2026-04-29T07:00:00');
    const html = renderCalendar(getMockCalendar(NOW), NOW);
    // The work event routes to "Tim (Work)", not the section label "Tim".
    expect(html).toContain(escapeAttr('"calendar":"Tim (Work)"'));
    // Personal events still fall back to the section label.
    expect(html).toContain(escapeAttr('"calendar":"Tim"'));
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

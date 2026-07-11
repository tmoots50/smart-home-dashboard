import { describe, expect, it } from 'vitest';
import { canonicalizeCalendarData, canonicalizeUpcoming } from './calendar.js';

describe('calendar label compatibility', () => {
  it('maps the current Caroline-labelled feed to Family in upcoming events', () => {
    expect(canonicalizeUpcoming([{ id: '1', calendar: 'Caroline' }])).toEqual([{ id: '1', calendar: 'Family' }]);
  });

  it('merges old Caroline cache data into an existing Family section', () => {
    const data = canonicalizeCalendarData({ sections: [
      { label: 'Family', events: [{ id: 'f', startsAt: '2026-07-10' }] },
      { label: 'Caroline', events: [{ id: 'c', startsAt: '2026-07-11' }] },
    ] });
    expect(data.sections).toEqual([{ label: 'Family', events: [
      { id: 'f', startsAt: '2026-07-10' },
      { id: 'c', startsAt: '2026-07-11' },
    ] }]);
  });
});

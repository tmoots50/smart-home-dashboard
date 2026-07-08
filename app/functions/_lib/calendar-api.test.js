// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { normalizeUpcoming, normalize, parseCalendars } from './calendar-api.js';

const timed = {
  id: 'e1',
  summary: 'Dentist',
  location: 'Midtown Dental',
  start: { dateTime: '2026-07-10T14:00:00-04:00' },
  end: { dateTime: '2026-07-10T15:00:00-04:00' },
};
const allDay = {
  id: 'e2',
  summary: 'Anniversary trip',
  start: { date: '2026-09-10' },
  end: { date: '2026-09-14' },
};

describe('normalizeUpcoming', () => {
  it('keeps all-day events (normalize drops them)', () => {
    expect(normalize([timed, allDay])).toHaveLength(1);
    const up = normalizeUpcoming([timed, allDay], 'Family');
    expect(up).toHaveLength(2);
    expect(up[1]).toEqual({
      id: 'e2',
      calendar: 'Family',
      title: 'Anniversary trip',
      sub: '',
      startsAt: '2026-09-10',
      endsAt: '2026-09-14',
      allDay: true,
    });
  });

  it('tags every event with its calendar label', () => {
    const up = normalizeUpcoming([timed], 'Tim');
    expect(up[0].calendar).toBe('Tim');
    expect(up[0].allDay).toBe(false);
    expect(up[0].startsAt).toBe('2026-07-10T14:00:00-04:00');
  });

  it('drops events with no start at all', () => {
    expect(normalizeUpcoming([{ id: 'broken' }], 'Tim')).toEqual([]);
  });

  it('defaults a missing summary', () => {
    const up = normalizeUpcoming([{ ...timed, summary: undefined }], 'Tim');
    expect(up[0].title).toBe('(no title)');
  });
});

describe('parseCalendars', () => {
  it('parses the JSON env var and filters malformed entries', () => {
    const env = { GOOGLE_CALENDARS_JSON: '[{"label":"Family","id":"abc"},{"bogus":1}]' };
    expect(parseCalendars(env)).toEqual([{ label: 'Family', id: 'abc' }]);
  });
  it('returns [] on missing or invalid JSON', () => {
    expect(parseCalendars({})).toEqual([]);
    expect(parseCalendars({ GOOGLE_CALENDARS_JSON: 'nope' })).toEqual([]);
  });
});

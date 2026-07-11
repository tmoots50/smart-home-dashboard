// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { normalizeUpcoming, normalize, parseCalendars, repairMojibake } from './calendar-api.js';

const timed = {
  id: 'e1',
  summary: 'Dentist',
  location: 'Midtown Dental',
  description: 'Bring insurance card.',
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
  it('keeps all-day events in both default and expanded agendas', () => {
    expect(normalize([timed, allDay])).toHaveLength(2);
    const up = normalizeUpcoming([timed, allDay], 'Family');
    expect(up).toHaveLength(2);
    expect(up[1]).toEqual({
      id: 'e2',
      calendar: 'Family',
      title: 'Anniversary trip',
      sub: '',
      description: '',
      startsAt: '2026-09-10',
      endsAt: '2026-09-14',
      allDay: true,
    });
  });

  it('passes description through to the normalized shape', () => {
    const up = normalizeUpcoming([timed], 'Tim');
    expect(up[0].description).toBe('Bring insurance card.');
  });

  it('tags every event with its calendar label', () => {
    const up = normalizeUpcoming([timed], 'Tim');
    expect(up[0].calendar).toBe('Tim');
    expect(up[0].allDay).toBe(false);
    expect(up[0].startsAt).toBe('2026-07-10T14:00:00-04:00');
    expect(up[0].endsAt).toBe('2026-07-10T15:00:00-04:00');
  });

  it('drops events with no start at all', () => {
    expect(normalizeUpcoming([{ id: 'broken' }], 'Tim')).toEqual([]);
  });

  it('defaults a missing summary', () => {
    const up = normalizeUpcoming([{ ...timed, summary: undefined }], 'Tim');
    expect(up[0].title).toBe('(no title)');
  });
});

describe('normalize', () => {
  it('passes description and endsAt through for timed events', () => {
    const [ev] = normalize([timed]);
    expect(ev.description).toBe('Bring insurance card.');
    expect(ev.endsAt).toBe('2026-07-10T15:00:00-04:00');
  });

  it('defaults description to empty string when missing', () => {
    const [ev] = normalize([{ ...timed, description: undefined }]);
    expect(ev.description).toBe('');
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

  it('treats the currently mislabeled Caroline calendar as Family', () => {
    const env = { GOOGLE_CALENDARS_JSON: '[{"label":"Caroline","id":"family-id"}]' };
    expect(parseCalendars(env)).toEqual([{ label: 'Family', id: 'family-id' }]);
  });
});

describe('repairMojibake', () => {
  it('repairs a C1-control mojibake apostrophe (the literal stored form)', () => {
    // 'Aidan' + \u00E2\u0080\u0099 ("â" + two C1 controls) + 's' — UTF-8 bytes
    // for \u2019 read back as Latin-1.
    expect(repairMojibake('Aidan\u00E2\u0080\u0099s 3rd Birthday')).toBe('Aidan\u2019s 3rd Birthday');
  });

  it('repairs the cp1252 display form (a-circumflex + euro + trademark)', () => {
    expect(repairMojibake('Aidan\u00E2\u20AC\u2122s 3rd Birthday')).toBe('Aidan\u2019s 3rd Birthday');
  });

  it('repairs curly quotes and dashes', () => {
    expect(repairMojibake('\u00E2\u20AC\u0153quoted\u00E2\u20AC\u009D \u00E2\u20AC\u201C dash')).toBe('\u201Cquoted\u201D \u2013 dash');
  });

  it('leaves genuine accented text untouched', () => {
    expect(repairMojibake('château')).toBe('château');
    expect(repairMojibake('Café ☕')).toBe('Café ☕');
    expect(repairMojibake('naïve résumé')).toBe('naïve résumé');
  });

  it('leaves plain ASCII and empty/non-string values untouched', () => {
    expect(repairMojibake('Lunch with Sarah')).toBe('Lunch with Sarah');
    expect(repairMojibake('')).toBe('');
    expect(repairMojibake(null)).toBe(null);
  });

  it('is applied to title, sub, and description in both normalizers', () => {
    const broken = {
      id: 'x',
      summary: 'Aidan\u00E2\u0080\u0099s party',
      location: 'Nana\u00E2\u0080\u0099s house',
      description: 'Don\u00E2\u0080\u0099t forget gifts',
      start: { date: '2026-07-12' },
      end: { date: '2026-07-13' },
    };
    const [a] = normalize([broken]);
    expect(a.title).toBe('Aidan\u2019s party');
    expect(a.sub).toBe('Nana\u2019s house');
    expect(a.description).toBe('Don\u2019t forget gifts');
    const [b] = normalizeUpcoming([broken], 'Family');
    expect(b.title).toBe('Aidan\u2019s party');
    expect(b.sub).toBe('Nana\u2019s house');
    expect(b.description).toBe('Don\u2019t forget gifts');
  });
});

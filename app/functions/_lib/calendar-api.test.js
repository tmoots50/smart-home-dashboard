// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeUpcoming, normalize, parseCalendars, repairMojibake, resolveRange, calendarIdFor, createEvent, deleteEvent, updateEvent, listEvents } from './calendar-api.js';

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
      person: 'Family',
      kind: 'personal',
      readOnly: false,
      title: 'Anniversary trip',
      sub: '',
      description: '',
      startsAt: '2026-09-10',
      endsAt: '2026-09-14',
      allDay: true,
      recurring: false,
    });
  });

  it('carries person/kind/readOnly for split work calendars, defaulting person to the label', () => {
    const [personal] = normalizeUpcoming([timed], 'Tim');
    expect(personal).toMatchObject({ calendar: 'Tim', person: 'Tim', kind: 'personal', readOnly: false });

    const [work] = normalizeUpcoming([timed], 'Tim (Work)', { person: 'Tim', kind: 'work' });
    expect(work).toMatchObject({ calendar: 'Tim (Work)', person: 'Tim', kind: 'work', readOnly: false });
  });

  it('marks instances of a repeating series as recurring', () => {
    const [event] = normalizeUpcoming([{ ...timed, recurringEventId: 'weekly-series' }], 'Family');
    expect(event.recurring).toBe(true);
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

  it('tags the card shape with calendar/person/kind/readOnly for the merge model', () => {
    const [plain] = normalize([timed]);
    expect(plain).toMatchObject({ calendar: '', person: '', kind: 'personal', readOnly: false });

    const [work] = normalize([timed], { calendar: 'Tim (Work)', person: 'Tim', kind: 'work' });
    expect(work).toMatchObject({ calendar: 'Tim (Work)', person: 'Tim', kind: 'work', readOnly: false });
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

describe('calendarIdFor', () => {
  const env = {
    GOOGLE_CALENDARS_JSON: '[{"label":"Family","id":"family@group.calendar.google.com"},{"label":"Tim","id":"tim@example.com"}]',
  };

  it('returns the id for an exact label match', () => {
    expect(calendarIdFor(env, 'Family')).toBe('family@group.calendar.google.com');
    expect(calendarIdFor(env, 'Tim')).toBe('tim@example.com');
  });

  it('is case-insensitive', () => {
    expect(calendarIdFor(env, 'family')).toBe('family@group.calendar.google.com');
    expect(calendarIdFor(env, 'TIM')).toBe('tim@example.com');
  });

  it('returns null for an unknown label', () => {
    expect(calendarIdFor(env, 'Work')).toBeNull();
    expect(calendarIdFor({}, 'Family')).toBeNull();
  });
});

describe('createEvent / deleteEvent / updateEvent', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('createEvent sends a POST with the right body for a timed event', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new-event-id' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await createEvent('tok', 'calId', {
      summary: 'Dentist',
      start: '2026-07-15T14:00:00-04:00',
      end: '2026-07-15T15:00:00-04:00',
      allDay: false,
      description: 'Check-up',
      location: 'Downtown Dental',
    });

    expect(result.id).toBe('new-event-id');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('calId');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.summary).toBe('Dentist');
    expect(body.start.dateTime).toBe('2026-07-15T14:00:00-04:00');
    expect(body.end.dateTime).toBe('2026-07-15T15:00:00-04:00');
    expect(body.description).toBe('Check-up');
  });

  it('createEvent uses date (not dateTime) for all-day events', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'x' }) }));
    await createEvent('tok', 'calId', { summary: 'Holiday', start: '2026-12-25', end: '2026-12-26', allDay: true });
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
    expect(body.start.date).toBe('2026-12-25');
    expect(body.start.dateTime).toBeUndefined();
  });

  it('createEvent omits empty description/location', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'x' }) }));
    await createEvent('tok', 'calId', { summary: 'Lunch', start: '2026-07-15T12:00:00Z', end: '2026-07-15T13:00:00Z' });
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
    expect(body.description).toBeUndefined();
    expect(body.location).toBeUndefined();
  });

  it('createEvent throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'forbidden' }));
    await expect(createEvent('tok', 'calId', { summary: 'x', start: 's', end: 'e' })).rejects.toThrow('403');
  });

  it('deleteEvent sends DELETE and resolves on 204', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', mockFetch);
    await expect(deleteEvent('tok', 'calId', 'evId')).resolves.toBeUndefined();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('evId');
    expect(opts.method).toBe('DELETE');
  });

  it('deleteEvent treats 410 (already gone) as success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 410 }));
    await expect(deleteEvent('tok', 'calId', 'evId')).resolves.toBeUndefined();
  });

  it('deleteEvent throws on other HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => 'not found' }));
    await expect(deleteEvent('tok', 'calId', 'evId')).rejects.toThrow('404');
  });

  it('updateEvent sends PATCH with only the supplied fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'evId' }) }));
    await updateEvent('tok', 'calId', 'evId', { summary: 'New Title', start: '2026-07-20T10:00:00-04:00' });
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
    expect(body.summary).toBe('New Title');
    expect(body.start.dateTime).toBe('2026-07-20T10:00:00-04:00');
    expect(body.end).toBeUndefined();
    expect(vi.mocked(fetch).mock.calls[0][1].method).toBe('PATCH');
  });

  it('updateEvent throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409, text: async () => 'conflict' }));
    await expect(updateEvent('tok', 'calId', 'evId', {})).rejects.toThrow('409');
  });
});

describe('listEvents pagination', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  const page = (items, nextPageToken) => ({ ok: true, json: async () => ({ items, ...(nextPageToken ? { nextPageToken } : {}) }) });

  it('returns a single page by default (maxPages omitted)', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(page([{ id: 'a' }, { id: 'b' }], 'TOKEN')); // has a next page, but default stops
    vi.stubGlobal('fetch', mockFetch);
    const items = await listEvents('tok', 'calId', 't0', 't1', { maxResults: 250 });
    expect(items.map(e => e.id)).toEqual(['a', 'b']);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('follows nextPageToken up to maxPages and concatenates', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(page([{ id: 'a' }], 'P2'))
      .mockResolvedValueOnce(page([{ id: 'b' }], 'P3'))
      .mockResolvedValueOnce(page([{ id: 'c' }], null)); // last page, no token
    vi.stubGlobal('fetch', mockFetch);
    const items = await listEvents('tok', 'calId', 't0', 't1', { maxResults: 1, maxPages: 12 });
    expect(items.map(e => e.id)).toEqual(['a', 'b', 'c']);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    // the 2nd/3rd requests must carry the prior page's token
    expect(String(mockFetch.mock.calls[1][0])).toContain('pageToken=P2');
    expect(String(mockFetch.mock.calls[2][0])).toContain('pageToken=P3');
  });

  it('stops at the maxPages backstop even if more pages remain', async () => {
    const mockFetch = vi.fn().mockResolvedValue(page([{ id: 'x' }], 'ALWAYS_MORE'));
    vi.stubGlobal('fetch', mockFetch);
    const items = await listEvents('tok', 'calId', 't0', 't1', { maxResults: 1, maxPages: 3 });
    expect(items).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('throws on HTTP error mid-pagination', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, text: async () => 'bad gateway' }));
    await expect(listEvents('tok', 'calId', 't0', 't1', { maxPages: 5 })).rejects.toThrow('502');
  });
});

describe('resolveRange', () => {
  const NOW = new Date('2026-07-10T12:00:00Z');
  const params = (obj) => new URLSearchParams(obj);

  it('?all=1 returns an uncapped −1yr…+3yr window with a page budget (Hermes sees ALL events)', () => {
    const r = resolveRange(params({ all: '1' }), NOW);
    const back = (+NOW - +new Date(r.timeMin)) / 86_400_000;
    const fwd = (+new Date(r.timeMax) - +NOW) / 86_400_000;
    expect(Math.round(back)).toBe(366);
    expect(Math.round(fwd)).toBe(1095);
    expect(r.maxPages).toBeGreaterThan(1);
  });

  it('?all=1 beats explicit range and days (highest priority)', () => {
    const r = resolveRange(params({ all: 'true', days: '7', timeMin: '2026-07-01T00:00:00Z', timeMax: '2026-07-05T00:00:00Z' }), NOW);
    expect((+new Date(r.timeMax) - +new Date(r.timeMin)) / 86_400_000).toBe(366 + 1095);
  });

  it('non-all ranges carry maxPages: 1 (single-page UI behavior preserved)', () => {
    expect(resolveRange(params({}), NOW).maxPages).toBe(1);
    expect(resolveRange(params({ days: '7' }), NOW).maxPages).toBe(1);
    expect(resolveRange(params({ timeMin: '2026-07-01T00:00:00Z', timeMax: '2026-08-01T00:00:00Z' }), NOW).maxPages).toBe(1);
  });

  it('honors a valid explicit timeMin/timeMax range', () => {
    const r = resolveRange(params({ timeMin: '2026-07-01T00:00:00Z', timeMax: '2026-08-01T00:00:00Z' }), NOW);
    expect(r.timeMin).toBe('2026-07-01T00:00:00.000Z');
    expect(r.timeMax).toBe('2026-08-01T00:00:00.000Z');
  });

  it('allows past months within the ±366-day window (month view needs them)', () => {
    const r = resolveRange(params({ timeMin: '2026-03-01T00:00:00Z', timeMax: '2026-04-01T00:00:00Z' }), NOW);
    expect(r.timeMin).toBe('2026-03-01T00:00:00.000Z');
  });

  it('rejects spans over 62 days → falls back to days default', () => {
    const r = resolveRange(params({ timeMin: '2026-07-01T00:00:00Z', timeMax: '2026-10-01T00:00:00Z' }), NOW);
    expect(r.timeMin).toBe(NOW.toISOString());
  });

  it('rejects ranges outside now ± 366 days', () => {
    const r = resolveRange(params({ timeMin: '2029-07-01T00:00:00Z', timeMax: '2029-08-01T00:00:00Z' }), NOW);
    expect(r.timeMin).toBe(NOW.toISOString());
  });

  it('rejects garbage and inverted ranges → days fallback', () => {
    expect(resolveRange(params({ timeMin: 'nope', timeMax: 'also nope' }), NOW).timeMin).toBe(NOW.toISOString());
    expect(resolveRange(params({ timeMin: '2026-08-01T00:00:00Z', timeMax: '2026-07-01T00:00:00Z' }), NOW).timeMin).toBe(NOW.toISOString());
  });

  it('keeps the legacy days behavior (default 90, clamped)', () => {
    const def = resolveRange(params({}), NOW);
    expect(new Date(def.timeMax) - new Date(def.timeMin)).toBe(90 * 86_400_000);
    const seven = resolveRange(params({ days: '7' }), NOW);
    expect(new Date(seven.timeMax) - new Date(seven.timeMin)).toBe(7 * 86_400_000);
    const big = resolveRange(params({ days: '500' }), NOW);
    expect(new Date(big.timeMax) - new Date(big.timeMin)).toBe(90 * 86_400_000);
  });
});

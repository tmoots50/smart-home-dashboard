import { describe, expect, it, vi, afterEach } from 'vitest';
import { canonicalizeCalendarData, canonicalizeUpcoming, fetchMonth } from './calendar.js';

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

describe('fetchMonth', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests [first of month, first of next month) and canonicalizes labels', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ events: [{ id: '1', calendar: 'Caroline', startsAt: '2026-07-05T10:00:00' }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const events = await fetchMonth(2026, 6); // July (0-based)
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain('timeMin=' + encodeURIComponent(new Date(2026, 6, 1).toISOString()));
    expect(url).toContain('timeMax=' + encodeURIComponent(new Date(2026, 7, 1).toISOString()));
    expect(events).toEqual([{ id: '1', calendar: 'Family', startsAt: '2026-07-05T10:00:00' }]);
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502 })));
    await expect(fetchMonth(2026, 6)).rejects.toThrow('502');
  });
});

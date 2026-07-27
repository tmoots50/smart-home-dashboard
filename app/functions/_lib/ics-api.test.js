// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseIcsCalendars, icsCalendarFor, expandIcs, fetchIcsEvents } from './ics-api.js';

// A realistic Outlook publish feed: a Windows-named TZID resolved via the
// embedded VTIMEZONE, a weekly MO/WE/FR series with COUNT + one EXDATE, a
// multi-day all-day event, and a summary carrying cp1252 mojibake.
const SAMPLE_ICS = `BEGIN:VCALENDAR
PRODID:-//Microsoft Corporation//Outlook//EN
VERSION:2.0
METHOD:PUBLISH
BEGIN:VTIMEZONE
TZID:Pacific Standard Time
BEGIN:STANDARD
DTSTART:16011104T020000
RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11
TZOFFSETFROM:-0700
TZOFFSETTO:-0800
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:16010311T020000
RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3
TZOFFSETFROM:-0800
TZOFFSETTO:-0700
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
UID:standup@outlook.com
SUMMARY:Team Standup
DTSTART;TZID=Pacific Standard Time:20260706T090000
DTEND;TZID=Pacific Standard Time:20260706T091500
RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=12
EXDATE;TZID=Pacific Standard Time:20260708T090000
LOCATION:Zoom
END:VEVENT
BEGIN:VEVENT
UID:offsite@outlook.com
SUMMARY:Aidanâs Offsite
DTSTART;VALUE=DATE:20260715
DTEND;VALUE=DATE:20260717
END:VEVENT
BEGIN:VEVENT
UID:oneoff@outlook.com
SUMMARY:1:1 with manager
DTSTART;TZID=Pacific Standard Time:20260709T140000
DTEND;TZID=Pacific Standard Time:20260709T143000
END:VEVENT
END:VCALENDAR`;

const JULY = { timeMin: '2026-07-01T00:00:00Z', timeMax: '2026-08-01T00:00:00Z' };
const META = { label: 'Caroline (Work)', person: 'Caroline', kind: 'work', readOnly: true };

// A gcatholic-style liturgical feed: all-day celebrations tagged with a rank
// ([S]/[F]/[M]/[m]) behind a color emoji, plus untagged ferial days that the
// 'liturgical-ranked' filter must drop.
const LITURGICAL_ICS = `BEGIN:VCALENDAR
PRODID:-//gcatholic.org//Liturgical Calendar//EN
VERSION:2.0
BEGIN:VEVENT
UID:assumption@gc
SUMMARY:⚪ [S] The Assumption of the Blessed Virgin Mary
DTSTART;VALUE=DATE:20260815
DTEND;VALUE=DATE:20260816
END:VEVENT
BEGIN:VEVENT
UID:lawrence@gc
SUMMARY:🔴 [F] Saint Lawrence\\, deacon and martyr
DTSTART;VALUE=DATE:20260810
DTEND;VALUE=DATE:20260811
END:VEVENT
BEGIN:VEVENT
UID:dominic@gc
SUMMARY:⚪ [M] Saint Dominic\\, priest
DTSTART;VALUE=DATE:20260808
DTEND;VALUE=DATE:20260809
END:VEVENT
BEGIN:VEVENT
UID:eudes@gc
SUMMARY:⚪ [m] Saint John Eudes\\, priest
DTSTART;VALUE=DATE:20260819
DTEND;VALUE=DATE:20260820
END:VEVENT
BEGIN:VEVENT
UID:ferial1@gc
SUMMARY:⚪ Monday of week 18 in Ordinary Time
DTSTART;VALUE=DATE:20260803
DTEND;VALUE=DATE:20260804
END:VEVENT
BEGIN:VEVENT
UID:ferial2@gc
SUMMARY:⚪ Saturday of week 20 in Ordinary Time
DTSTART;VALUE=DATE:20260822
DTEND;VALUE=DATE:20260823
END:VEVENT
END:VCALENDAR`;

const AUG = { timeMin: '2026-08-01T00:00:00Z', timeMax: '2026-09-01T00:00:00Z' };
const LIT_META = { label: 'Catholic Calendar', person: 'Catholic', kind: 'personal', filter: 'liturgical-ranked' };

describe('parseIcsCalendars', () => {
  it('parses the JSON env var, defaulting person to label and marking read-only', () => {
    const env = { ICS_CALENDARS_JSON: '[{"label":"Caroline (Work)","url":"https://x/y.ics","kind":"work","person":"Caroline"}]' };
    expect(parseIcsCalendars(env)).toEqual([
      { label: 'Caroline (Work)', url: 'https://x/y.ics', person: 'Caroline', kind: 'work', readOnly: true },
    ]);
  });

  it('defaults person to label and kind to personal', () => {
    const env = { ICS_CALENDARS_JSON: '[{"label":"Team","url":"https://x/team.ics"}]' };
    expect(parseIcsCalendars(env)).toEqual([
      { label: 'Team', url: 'https://x/team.ics', person: 'Team', kind: 'personal', readOnly: true },
    ]);
  });

  it('filters malformed entries and returns [] on missing/invalid JSON', () => {
    expect(parseIcsCalendars({ ICS_CALENDARS_JSON: '[{"label":"ok","url":"u"},{"label":"nourl"},{"url":"nolabel"}]' }))
      .toHaveLength(1);
    expect(parseIcsCalendars({})).toEqual([]);
    expect(parseIcsCalendars({ ICS_CALENDARS_JSON: 'not json' })).toEqual([]);
  });

  it('passes through a known filter and ignores unknown filter values', () => {
    const env = { ICS_CALENDARS_JSON: JSON.stringify([
      { label: 'Catholic Calendar', url: 'https://g/us.ics', person: 'Catholic', filter: 'liturgical-ranked' },
      { label: 'Other', url: 'https://x/o.ics', filter: 'bogus' },
    ]) };
    const cals = parseIcsCalendars(env);
    expect(cals[0].filter).toBe('liturgical-ranked');
    expect(cals[1].filter).toBeUndefined();
  });
});

describe('icsCalendarFor', () => {
  const env = { ICS_CALENDARS_JSON: '[{"label":"Caroline (Work)","url":"https://x/y.ics","kind":"work"}]' };
  it('matches case-insensitively (used to 403 writes to read-only feeds)', () => {
    expect(icsCalendarFor(env, 'Caroline (Work)')?.readOnly).toBe(true);
    expect(icsCalendarFor(env, 'caroline (work)')?.label).toBe('Caroline (Work)');
  });
  it('returns null for a non-ICS label (so Google writes proceed)', () => {
    expect(icsCalendarFor(env, 'Tim (Work)')).toBeNull();
    expect(icsCalendarFor({}, 'anything')).toBeNull();
  });
});

describe('expandIcs', () => {
  it('resolves a Windows-named TZID to the correct UTC instant', () => {
    const [first] = expandIcs(SAMPLE_ICS, JULY.timeMin, JULY.timeMax, META)
      .filter(e => e.title === 'Team Standup')
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    // 09:00 PDT (UTC-7 in July) → 16:00Z
    expect(first.startsAt).toBe('2026-07-06T16:00:00.000Z');
    expect(first.allDay).toBe(false);
    expect(first.sub).toBe('Zoom');
  });

  it('expands a weekly series and honors EXDATE, with unique ids per instance', () => {
    const standups = expandIcs(SAMPLE_ICS, JULY.timeMin, JULY.timeMax, META).filter(e => e.title === 'Team Standup');
    expect(standups).toHaveLength(11); // COUNT=12 minus the one EXDATE
    expect(standups.every(e => e.recurring)).toBe(true);
    expect(standups.some(e => e.startsAt.startsWith('2026-07-08'))).toBe(false); // EXDATE dropped
    expect(new Set(standups.map(e => e.id)).size).toBe(11); // ids unique
  });

  it('keeps all-day events as bare dates with an exclusive end', () => {
    const [offsite] = expandIcs(SAMPLE_ICS, JULY.timeMin, JULY.timeMax, META).filter(e => e.title.includes('Offsite'));
    expect(offsite.allDay).toBe(true);
    expect(offsite.startsAt).toBe('2026-07-15');
    expect(offsite.endsAt).toBe('2026-07-17'); // exclusive — event runs 15th–16th
  });

  it('repairs mojibake in summaries', () => {
    const [offsite] = expandIcs(SAMPLE_ICS, JULY.timeMin, JULY.timeMax, META).filter(e => e.title.includes('Offsite'));
    expect(offsite.title).toBe('Aidan’s Offsite');
  });

  it('tags every event with calendar/person/kind/readOnly', () => {
    const evs = expandIcs(SAMPLE_ICS, JULY.timeMin, JULY.timeMax, META);
    expect(evs.length).toBeGreaterThan(0);
    expect(evs.every(e => e.calendar === 'Caroline (Work)' && e.person === 'Caroline' && e.kind === 'work' && e.readOnly === true)).toBe(true);
  });

  it('filters to the requested window', () => {
    const oneDay = expandIcs(SAMPLE_ICS, '2026-07-09T00:00:00Z', '2026-07-10T00:00:00Z', META);
    expect(oneDay.map(e => e.title).sort()).toEqual(['1:1 with manager']); // only the Jul 9 one-off (standup EXDATE'd on the 8th, none on the 9th)
  });
});

describe('expandIcs — liturgical-ranked filter (gcatholic feasts)', () => {
  it('keeps only rank-tagged celebrations and drops untagged ferial days', () => {
    const titles = expandIcs(LITURGICAL_ICS, AUG.timeMin, AUG.timeMax, LIT_META).map(e => e.title).sort();
    expect(titles).toEqual([
      'Saint Dominic, priest',
      'Saint John Eudes, priest',
      'Saint Lawrence, deacon and martyr',
      'The Assumption of the Blessed Virgin Mary',
    ]);
    expect(titles.some(t => /Ordinary Time/.test(t))).toBe(false); // ferials gone
  });

  it('strips the emoji + rank tag, records the rank, stamps liturgical, keeps all-day + tags', () => {
    const evs = expandIcs(LITURGICAL_ICS, AUG.timeMin, AUG.timeMax, LIT_META);
    const assumption = evs.find(e => e.title.includes('Assumption'));
    expect(assumption).toMatchObject({
      title: 'The Assumption of the Blessed Virgin Mary', // no ⚪ / [S]
      rank: 'S', liturgical: true, allDay: true,
      calendar: 'Catholic Calendar', person: 'Catholic', kind: 'personal',
    });
    expect(evs.every(e => e.liturgical === true)).toBe(true);
    expect(new Set(evs.map(e => e.rank))).toEqual(new Set(['S', 'F', 'M', 'm'])); // all four ranks kept
  });

  it('without the filter, the same feed keeps ferials and leaves titles (tag) untouched', () => {
    const evs = expandIcs(LITURGICAL_ICS, AUG.timeMin, AUG.timeMax, { ...LIT_META, filter: undefined });
    expect(evs.some(e => /Ordinary Time/.test(e.title))).toBe(true);
    expect(evs.some(e => e.title.includes('[S]'))).toBe(true); // tag NOT stripped
    expect(evs.every(e => e.liturgical === undefined)).toBe(true);
  });
});

describe('fetchIcsEvents', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  const env = () => ({ ICS_CALENDARS_JSON: JSON.stringify([{ label: 'Caroline (Work)', url: 'https://feed/cal.ics', person: 'Caroline', kind: 'work' }]) });

  it('fetches, expands, and tags events (no KV binding present)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE_ICS }));
    const evs = await fetchIcsEvents(env(), JULY.timeMin, JULY.timeMax);
    expect(evs.filter(e => e.title === 'Team Standup')).toHaveLength(11);
    expect(evs.every(e => e.person === 'Caroline' && e.kind === 'work')).toBe(true);
  });

  it('returns [] when no ICS calendars are configured (interim state)', async () => {
    const spy = vi.stubGlobal('fetch', vi.fn());
    expect(await fetchIcsEvents({}, JULY.timeMin, JULY.timeMax)).toEqual([]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('fails soft per calendar: a dead feed yields [] instead of throwing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => '' }));
    await expect(fetchIcsEvents(env(), JULY.timeMin, JULY.timeMax)).resolves.toEqual([]);
  });

  it('uses a fresh KV cache entry without hitting the network', async () => {
    const store = new Map([[`ics:https://feed/cal.ics`, JSON.stringify({ at: Date.now(), text: SAMPLE_ICS })]]);
    const kv = { get: async (k) => store.get(k) ?? null, put: async (k, v) => void store.set(k, v) };
    const fetchSpy = vi.stubGlobal('fetch', vi.fn());
    const evs = await fetchIcsEvents({ ...env(), ICS_CACHE: kv }, JULY.timeMin, JULY.timeMax);
    expect(evs.filter(e => e.title === 'Team Standup')).toHaveLength(11);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled(); // served from cache
  });

  it('serves a stale cached copy when the feed is unreachable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stale = { at: Date.now() - 60 * 60 * 1000, text: SAMPLE_ICS }; // 1h old → past soft TTL
    const store = new Map([[`ics:https://feed/cal.ics`, JSON.stringify(stale)]]);
    const kv = { get: async (k) => store.get(k) ?? null, put: async () => {} };
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const evs = await fetchIcsEvents({ ...env(), ICS_CACHE: kv }, JULY.timeMin, JULY.timeMax);
    expect(evs.filter(e => e.title === 'Team Standup')).toHaveLength(11); // stale-but-served
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce(); // it did try to refresh
  });

  it('writes fetched ICS into KV for next time', async () => {
    const store = new Map();
    const kv = { get: async (k) => store.get(k) ?? null, put: async (k, v) => void store.set(k, v) };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE_ICS }));
    await fetchIcsEvents({ ...env(), ICS_CACHE: kv }, JULY.timeMin, JULY.timeMax);
    expect(store.has('ics:https://feed/cal.ics')).toBe(true);
    expect(JSON.parse(store.get('ics:https://feed/cal.ics')).text).toContain('Team Standup');
  });
});

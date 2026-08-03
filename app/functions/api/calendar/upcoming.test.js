// Endpoint-level tests for GET /api/calendar/upcoming.
//
// This is the behavioral gate for the liturgical ICS CPU guard: it exercises the
// real HTTP handler a dashboard/Hermes caller invokes, while stubbing only the
// Google network calls that are unrelated to the ICS feed path.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { listEvents } = vi.hoisted(() => ({ listEvents: vi.fn() }));

vi.mock('../../_lib/google-auth.js', () => ({
  getAccessToken: vi.fn().mockResolvedValue('access-tok'),
}));

vi.mock('../../_lib/calendar-api.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, listEvents };
});

import { onRequest } from './upcoming.js';

const env = {
  DASHBOARD_TOKEN: 'tok',
  GOOGLE_CLIENT_ID: 'cid',
  GOOGLE_CLIENT_SECRET: 'secret',
  GOOGLE_REFRESH_TOKEN: 'refresh',
  GOOGLE_CALENDARS_JSON: JSON.stringify([
    { label: 'Family', id: 'family@group.calendar.google.com' },
  ]),
  ICS_CALENDARS_JSON: JSON.stringify([
    { label: 'Catholic Calendar', url: 'https://gc.example/liturgical.ics', person: 'Catholic', filter: 'liturgical-ranked' },
  ]),
};

function productionSizedLiturgicalIcs() {
  const events = [];
  for (let i = 0; i < 494; i += 1) {
    const day = new Date(Date.UTC(2026, 0, 1 + (i % 365))).toISOString().slice(0, 10).replaceAll('-', '');
    const nextDay = new Date(Date.UTC(2026, 0, 2 + (i % 365))).toISOString().slice(0, 10).replaceAll('-', '');
    const summary = i < 214 ? `⚪ [M] Ranked celebration ${i}` : `⚪ Ferial day ${i}`;
    events.push(`BEGIN:VEVENT\r\nUID:production-${i}@gc\r\nSUMMARY:${summary}\r\nDTSTART;VALUE=DATE:${day}\r\nDTEND;VALUE=DATE:${nextDay}\r\nEND:VEVENT\r\n`);
  }
  return `BEGIN:VCALENDAR\r\nPRODID:-//gcatholic.org//Liturgical Calendar//EN\r\nVERSION:2.0\r\n${events.join('')}END:VCALENDAR\r\n`;
}

function getUpcoming() {
  return new Request('https://dash.example/api/calendar/upcoming?all=1', {
    method: 'GET',
    headers: { authorization: 'Bearer tok' },
  });
}

describe('GET /api/calendar/upcoming — liturgical ICS behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    listEvents.mockReset();
    listEvents.mockResolvedValue([]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => productionSizedLiturgicalIcs() }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('serves the endpoint with only ranked liturgical events from a production-sized feed', async () => {
    const res = await onRequest({ request: getUpcoming(), env });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.events).toHaveLength(214);
    expect(body.events.every(e => e.calendar === 'Catholic Calendar' && e.person === 'Catholic')).toBe(true);
    expect(body.events.every(e => e.liturgical === true && e.rank === 'M')).toBe(true);
    expect(body.events.some(e => /Ferial day/.test(e.title))).toBe(false);
    expect(body.events[0].title).toBe('Ranked celebration 0');
    expect(listEvents).toHaveBeenCalledOnce();
  });
});

// Endpoint-level tests for POST /api/calendar/events.
//
// We keep the real calendar-api module (so googleCalendarFor's canonicalization
// is exercised for real against GOOGLE_CALENDARS_JSON) but stub the two calls
// that reach the network: getAccessToken and createEvent. That lets us assert
// the handler's body parsing — including the optional recurrence passthrough
// and the Family-alias calendar lookup — without touching Google.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { createEvent } = vi.hoisted(() => ({ createEvent: vi.fn() }));

vi.mock('../../_lib/google-auth.js', () => ({
  getAccessToken: vi.fn().mockResolvedValue('access-tok'),
}));

vi.mock('../../_lib/calendar-api.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, createEvent };
});

import { onRequest } from './events.js';

const env = {
  DASHBOARD_TOKEN: 'tok',
  GOOGLE_CLIENT_ID: 'cid',
  GOOGLE_CLIENT_SECRET: 'secret',
  GOOGLE_REFRESH_TOKEN: 'refresh',
  GOOGLE_CALENDARS_JSON: JSON.stringify([
    { label: 'Family', id: 'family@group.calendar.google.com' },
  ]),
};

function post(body) {
  return new Request('https://dash.example/api/calendar/events', {
    method: 'POST',
    headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/calendar/events', () => {
  beforeEach(() => {
    createEvent.mockReset();
    createEvent.mockResolvedValue({ id: 'new-id' });
  });

  it('resolves the "Caroline & Tim" alias to the Family calendar (no 404)', async () => {
    const res = await onRequest({ request: post({ calendar: 'Caroline & Tim', summary: 'Dinner', start: '2026-07-15T18:00:00-04:00' }), env });
    expect(res.status).toBe(200);
    expect(createEvent).toHaveBeenCalledTimes(1);
    // routed to the Family calendar id
    expect(createEvent.mock.calls[0][1]).toBe('family@group.calendar.google.com');
  });

  it('passes recurrence through to createEvent when present', async () => {
    await onRequest({ request: post({
      calendar: 'Family',
      summary: 'Weekly standup',
      start: '2026-07-15T18:00:00-04:00',
      recurrence: ['RRULE:FREQ=WEEKLY;COUNT=3'],
    }), env });
    expect(createEvent.mock.calls[0][2].recurrence).toEqual(['RRULE:FREQ=WEEKLY;COUNT=3']);
  });

  it('leaves recurrence undefined when not supplied', async () => {
    await onRequest({ request: post({ calendar: 'Family', summary: 'One-off', start: '2026-07-15T18:00:00-04:00' }), env });
    expect(createEvent.mock.calls[0][2].recurrence).toBeUndefined();
  });

  it('rejects a non-array recurrence with 400', async () => {
    const res = await onRequest({ request: post({
      calendar: 'Family', summary: 'Bad', start: '2026-07-15T18:00:00-04:00', recurrence: 'RRULE:FREQ=WEEKLY',
    }), env });
    expect(res.status).toBe(400);
    expect(createEvent).not.toHaveBeenCalled();
  });
});

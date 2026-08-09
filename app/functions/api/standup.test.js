// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from './standup.js';

const request = (method = 'GET', token = 'dashboard-token') => new Request('https://dashboard.example/api/standup', {
  method,
  headers: token ? { authorization: `Bearer ${token}` } : {},
});

const env = { DASHBOARD_TOKEN: 'dashboard-token', LINEAR_API_KEY: 'linear-key' };

afterEach(() => vi.unstubAllGlobals());

describe('GET /api/standup', () => {
  it('requires dashboard authentication before touching Linear', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await onRequest({ request: request('GET', ''), env });

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns an explicit unavailable payload when the Linear key is missing', async () => {
    const response = await onRequest({ request: request(), env: { DASHBOARD_TOKEN: 'dashboard-token' } });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ state: 'unavailable', source: 'linear' });
    expect(body.message).toContain('not configured');
  });

  it('returns normalized five-agent Linear data with short cache metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        issues: {
          nodes: [{
            identifier: 'PRO-133',
            title: 'Mount real standup',
            completedAt: null,
            updatedAt: '2026-08-09T10:00:00.000Z',
            state: { name: 'In Progress', type: 'started' },
            assignee: { name: 'Derek' },
            project: { name: 'Smart Home Dashboard' },
            labels: { nodes: [] },
            comments: { nodes: [] },
          }],
        },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await onRequest({ request: request(), env, now: new Date('2026-08-09T12:00:00.000Z') });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('max-age=60');
    expect(body.agents).toHaveLength(5);
    expect(body.agents.find(agent => agent.name === 'Derek').columns.today[0].issue).toBe('PRO-133');
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('linear-key');
  });

  it('degrades to an honest unavailable response on malformed upstream data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [{ message: 'bad query' }] }), { status: 200 })));

    const response = await onRequest({ request: request(), env });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.state).toBe('unavailable');
    expect(body.message).toBe('Linear standup is temporarily unavailable.');
  });
});

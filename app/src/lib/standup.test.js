import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const payload = (overrides = {}) => ({
  state: 'ready',
  source: 'linear',
  generatedAt: '2026-08-09T12:00:00.000Z',
  freshness: 'Linear · updated 2026-08-09T12:00:00.000Z',
  unresolved: [],
  truncated: 0,
  agents: [
    { name: 'Nigel', initials: 'NI', columns: { yesterday: [], today: [], blockers: [] } },
    { name: 'Derek', initials: 'DE', columns: { yesterday: [], today: [], blockers: [] } },
    { name: 'Mo', initials: 'MO', columns: { yesterday: [], today: [], blockers: [] } },
    { name: 'Smith', initials: 'SM', columns: { yesterday: [], today: [], blockers: [] } },
    { name: 'Sam', initials: 'SA', columns: { yesterday: [], today: [], blockers: [] } },
  ],
  ...overrides,
});

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('getStandup', () => {
  it('marks bundled fixture data as Demo data in tokenless development', async () => {
    vi.stubEnv('VITE_DASHBOARD_TOKEN', '');
    const { getStandup } = await import('./standup.js');

    const source = getStandup();

    expect(source.initial.source).toBe('demo');
    expect(source.initial.freshness).toContain('Demo data');
    await expect(source.live).resolves.toBe(source.initial);
  });

  it('fetches authenticated Linear data and caches the real payload', async () => {
    vi.stubEnv('VITE_DASHBOARD_TOKEN', 'wall-token');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { getStandup } = await import('./standup.js');

    const source = getStandup();
    const live = await source.live;

    expect(source.initial.state).toBe('loading');
    expect(live.agents).toHaveLength(5);
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer wall-token');
    expect(JSON.parse(localStorage.getItem('standup:v1')).data.source).toBe('linear');
  });

  it('shows explicit unavailable state instead of mock data when a configured fetch fails uncached', async () => {
    vi.stubEnv('VITE_DASHBOARD_TOKEN', 'wall-token');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const { getStandup } = await import('./standup.js');

    const source = getStandup();

    expect(source.initial.state).toBe('loading');
    await expect(source.live).resolves.toMatchObject({
      state: 'unavailable',
      source: 'linear',
      agents: [],
    });
  });

  it('keeps last-known real data visibly stale when the live request fails', async () => {
    vi.stubEnv('VITE_DASHBOARD_TOKEN', 'wall-token');
    localStorage.setItem('standup:v1', JSON.stringify({
      at: Date.now() - 10 * 60 * 1000,
      data: payload(),
    }));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const { getStandup } = await import('./standup.js');

    const source = getStandup();
    const live = await source.live;

    expect(source.initial.state).toBe('stale');
    expect(source.initial.freshness).toContain('stale');
    expect(live.state).toBe('stale');
    expect(live.agents).toHaveLength(5);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { setTaskCompleted } from './tasks-api.js';

describe('setTaskCompleted', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('marks a Google task completed', async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
    vi.stubGlobal('fetch', fetch);
    await setTaskCompleted('token', 'list', 'task', true);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ status: 'completed' });
  });

  it('reopens a completed Google task', async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
    vi.stubGlobal('fetch', fetch);
    await setTaskCompleted('token', 'list', 'task', false);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ status: 'needsAction', completed: null });
  });
});

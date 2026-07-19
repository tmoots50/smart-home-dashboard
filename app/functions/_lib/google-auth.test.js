import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAccessToken } from './google-auth.js';

// Note: the module caches access tokens keyed by REFRESH token value, so each
// test uses distinct refresh-token strings to stay cache-independent.

const baseEnv = {
  GOOGLE_CLIENT_ID: 'cid',
  GOOGLE_CLIENT_SECRET: 'csec',
};

function mockTokenEndpoint() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts) => {
    const refresh = new URLSearchParams(opts.body).get('refresh_token');
    return new Response(JSON.stringify({ access_token: `at-for-${refresh}`, expires_in: 3600 }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  });
}

afterEach(() => vi.restoreAllMocks());

describe('getAccessToken', () => {
  it('uses GOOGLE_REFRESH_TOKEN by default', async () => {
    mockTokenEndpoint();
    const token = await getAccessToken({ ...baseEnv, GOOGLE_REFRESH_TOKEN: 'rt-default-1' });
    expect(token).toBe('at-for-rt-default-1');
  });

  it('a named token resolves GOOGLE_REFRESH_TOKEN_<NAME>', async () => {
    mockTokenEndpoint();
    const env = { ...baseEnv, GOOGLE_REFRESH_TOKEN: 'rt-default-2', GOOGLE_REFRESH_TOKEN_WORK: 'rt-work-2' };
    expect(await getAccessToken(env, 'work')).toBe('at-for-rt-work-2');
  });

  it('throws naming the missing env var when a named token is not configured', async () => {
    mockTokenEndpoint();
    const env = { ...baseEnv, GOOGLE_REFRESH_TOKEN: 'rt-default-3' };
    await expect(getAccessToken(env, 'work')).rejects.toThrow(/GOOGLE_REFRESH_TOKEN_WORK/);
  });

  it('caches per refresh token — two names, two tokens, no cross-talk', async () => {
    const spy = mockTokenEndpoint();
    const env = { ...baseEnv, GOOGLE_REFRESH_TOKEN: 'rt-default-4', GOOGLE_REFRESH_TOKEN_WORK: 'rt-work-4' };
    await getAccessToken(env);
    await getAccessToken(env, 'work');
    await getAccessToken(env); // cache hit — no third fetch
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

import { describe, it, expect, vi } from 'vitest';

vi.mock('./daybrief.js', () => ({ fetchDaybrief: vi.fn() }));
import { fetchDaybrief } from './daybrief.js';
import { awaitCheckinBrief } from './checkin.js';

// sleep is injected as a no-op so the poll loop spins through its attempts
// instantly; timeoutMs bounds the number of iterations.
const noSleep = () => Promise.resolve();

const checkin = (generatedAt) => ({
  kind: 'checkin', date: '2026-07-27', generatedAt, headline: 'x',
});

describe('awaitCheckinBrief', () => {
  it('resolves when a check-in with a new generatedAt lands', async () => {
    fetchDaybrief
      .mockResolvedValueOnce({ kind: 'morning', generatedAt: 'A' }) // still the morning brief
      .mockResolvedValueOnce(checkin('A'))                          // stale marker — not new
      .mockResolvedValueOnce(checkin('B'));
    const blob = await awaitCheckinBrief({ afterGeneratedAt: 'A', timeoutMs: 1000, intervalMs: 1, sleep: noSleep });
    expect(blob.generatedAt).toBe('B');
  });

  it('accepts any check-in when there was no prior blob', async () => {
    fetchDaybrief.mockResolvedValueOnce(checkin('C'));
    const blob = await awaitCheckinBrief({ afterGeneratedAt: null, timeoutMs: 1000, intervalMs: 1, sleep: noSleep });
    expect(blob.generatedAt).toBe('C');
  });

  it('survives transient fetch failures and keeps polling', async () => {
    fetchDaybrief
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(checkin('D'));
    const blob = await awaitCheckinBrief({ afterGeneratedAt: null, timeoutMs: 1000, intervalMs: 1, sleep: noSleep });
    expect(blob.generatedAt).toBe('D');
  });

  it('returns null when nothing new arrives before the deadline', async () => {
    fetchDaybrief.mockResolvedValue({ kind: 'morning', generatedAt: 'A' });
    let polls = 0;
    const sleep = () => { polls += 1; return Promise.resolve(); };
    const blob = await awaitCheckinBrief({ afterGeneratedAt: 'A', timeoutMs: 30, intervalMs: 1, sleep });
    expect(blob).toBeNull();
    expect(polls).toBeGreaterThan(0);
  });
});

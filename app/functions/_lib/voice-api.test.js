import { describe, expect, it, vi } from 'vitest';
import { bytesToBase64, MAX_AUDIO_BYTES, transcribeAudio, validateAudio } from './voice-api.js';

describe('voice API helpers', () => {
  it('validates empty, oversized, and valid recordings', () => {
    expect(validateAudio(new Uint8Array())).toMatchObject({ ok: false, status: 400 });
    expect(validateAudio(new Uint8Array(MAX_AUDIO_BYTES + 1))).toMatchObject({ ok: false, status: 413 });
    expect(validateAudio(new Uint8Array([1]))).toEqual({ ok: true });
  });
  it('base64 encodes across 8KB chunk boundaries', () => {
    const bytes = new Uint8Array(17_000).map((_, index) => index % 251);
    expect(atob(bytesToBase64(bytes)).length).toBe(17_000);
  });
  it('falls back to the next model', async () => {
    const ai = { run: vi.fn().mockRejectedValueOnce(new Error('unsupported')).mockResolvedValueOnce({ text: 'hello home' }) };
    await expect(transcribeAudio(ai, new Uint8Array([1,2]), ['large', 'small'])).resolves.toMatchObject({ transcript: 'hello home', model: 'small' });
  });
});


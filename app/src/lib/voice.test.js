import { describe, expect, it, vi } from 'vitest';
import { createRecorder, isSupported } from './voice.js';

class FakeRecorder extends EventTarget {
  static isTypeSupported(type) { return type.includes('opus'); }
  constructor(stream, options) { super(); this.stream = stream; this.mimeType = options.mimeType; this.state = 'inactive'; }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.dispatchEvent(new MessageEvent('dataavailable', { data: new Blob(['voice']) }));
    this.dispatchEvent(new Event('stop'));
  }
}

describe('voice recorder', () => {
  it('reports browser support from injected capabilities', () => {
    expect(isSupported({ navigatorRef: { mediaDevices: { getUserMedia() {} } }, mediaRecorderCtor: FakeRecorder })).toBe(true);
    expect(isSupported({ navigatorRef: {}, mediaRecorderCtor: FakeRecorder })).toBe(false);
  });
  it('records webm/opus and releases the microphone', async () => {
    const stopTrack = vi.fn();
    const recorder = createRecorder({
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
      mediaRecorderCtor: FakeRecorder, audioContextCtor: null,
    });
    await recorder.start();
    const blob = await recorder.stop();
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('audio/webm;codecs=opus');
    expect(stopTrack).toHaveBeenCalled();
  });
});


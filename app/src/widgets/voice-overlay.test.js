import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openVoiceOverlay, renderVoiceOverlay } from './voice-overlay.js';
import { states } from './voice-overlay.fixtures.js';

describe('renderVoiceOverlay', () => {
  beforeEach(() => { document.body.innerHTML = ''; document.documentElement.classList.remove('has-overlay'); });
  for (const [name, state] of Object.entries(states)) {
    it(`renders ${name}`, () => {
      const html = renderVoiceOverlay(state);
      expect(html).toContain('voice-overlay');
      expect(html).not.toContain('undefined');
    });
  }
  it('escapes transcripts and replies', () => {
    const html = renderVoiceOverlay({ kind: 'reply', transcript: '<script>x</script>', reply: '<img onerror=x>' });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
  });

  it('walks recording → transcript → send → reply', async () => {
    const recorder = { start: vi.fn().mockResolvedValue(), stop: vi.fn().mockResolvedValue(new Blob(['voice'])), onLevel: vi.fn() };
    const voice = {
      createRecorder: () => recorder,
      transcribe: vi.fn().mockResolvedValue('Add milk to groceries'),
      sendCommand: vi.fn().mockResolvedValue({ status: 'replied', reply: 'Done.' }),
    };
    openVoiceOverlay(voice);
    await Promise.resolve();
    expect(document.querySelector('.voice-overlay--recording')).toBeTruthy();
    document.querySelector('[data-voice-action="stop"]').click();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(document.querySelector('.voice-overlay--confirm')).toBeTruthy();
    document.querySelector('[data-voice-action="pause"]').click();
    expect(document.querySelector('.voice-transcript').className).toContain('is-paused');
    document.querySelector('[data-voice-action="send"]').click();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(document.querySelector('.voice-overlay--reply')).toBeTruthy();
    expect(voice.sendCommand).toHaveBeenCalledWith('Add milk to groceries');
  });

  it('maps denied microphone access to a designed error', async () => {
    openVoiceOverlay({ createRecorder: () => ({ start: () => Promise.reject(new Error('denied')), stop: vi.fn(), onLevel: vi.fn() }) });
    await Promise.resolve(); await Promise.resolve();
    expect(document.querySelector('.voice-overlay--error').textContent).toContain('Microphone access is off');
  });
});

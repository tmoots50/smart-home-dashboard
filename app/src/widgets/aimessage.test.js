import { describe, it, expect } from 'vitest';
import { renderAiMessage } from './aimessage.js';
import { getMockAiMessage } from '../lib/aimessage-mock.js';

const NOW = new Date('2026-05-01T22:00:00');

describe('renderAiMessage', () => {
  it('renders the source label and the message text', () => {
    const msg = getMockAiMessage(NOW);
    const html = renderAiMessage(msg, NOW);
    expect(html).toContain(msg.source);
    expect(html).toContain('nursing roll');
  });

  it('renders relative time-ago in the title', () => {
    const msg = { text: 'x', source: 'Jarvis', sentAt: new Date(NOW.getTime() - 7 * 60_000).toISOString() };
    const html = renderAiMessage(msg, NOW);
    expect(html).toContain('7m ago');
  });

  it('returns empty string when msg is null', () => {
    expect(renderAiMessage(null)).toBe('');
  });

  it('escapes HTML in the message text', () => {
    const html = renderAiMessage({ text: '<x>', source: 'AI', sentAt: NOW.toISOString() }, NOW);
    expect(html).not.toContain('<x>');
  });
});

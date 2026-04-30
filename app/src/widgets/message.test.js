import { describe, it, expect } from 'vitest';
import { renderMessage } from './message.js';
import { getMockMessage } from '../lib/message-mock.js';

describe('renderMessage', () => {
  it('renders quote and author', () => {
    const msg = getMockMessage();
    const html = renderMessage(msg);
    expect(html).toContain(msg.quote);
    expect(html).toContain(msg.from);
  });

  it('returns empty string when there is no message', () => {
    expect(renderMessage(null)).toBe('');
  });

  it('escapes HTML in the quote', () => {
    const html = renderMessage({ quote: '<script>x</script>', from: 'X' });
    expect(html).not.toContain('<script>');
  });
});

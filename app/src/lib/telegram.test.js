import { describe, it, expect, vi } from 'vitest';
import { openHermesChat, hermesChatUrl, HERMES_BOT } from './telegram.js';

describe('telegram deep link', () => {
  it('targets the Hermes bot over the tg:// scheme (never https://t.me — see module header)', () => {
    expect(hermesChatUrl).toBe(`tg://resolve?domain=${HERMES_BOT}`);
    expect(hermesChatUrl.startsWith('tg://')).toBe(true);
  });

  it('navigates to the chat url', () => {
    const navigate = vi.fn();
    openHermesChat(navigate);
    expect(navigate).toHaveBeenCalledWith(hermesChatUrl);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderClock, mountClock } from './clock.js';

describe('renderClock', () => {
  it('renders time and date slots wrapped in a clock container', () => {
    const html = renderClock(new Date('2026-04-29T14:30:00Z'));
    expect(html).toContain('class="clock"');
    expect(html).toContain('class="clock__time"');
    expect(html).toContain('class="clock__date"');
    expect(html).not.toContain('Invalid');
  });

  it('defaults to now when no date is given', () => {
    expect(() => renderClock()).not.toThrow();
  });
});

describe('mountClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T08:15:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders into the slot immediately', () => {
    const slot = document.createElement('div');
    mountClock(slot);
    expect(slot.innerHTML).toContain('class="clock__time"');
  });

  it('re-renders on tick', () => {
    const slot = document.createElement('div');
    mountClock(slot);
    const initial = slot.innerHTML;

    vi.setSystemTime(new Date('2026-04-29T08:46:00'));
    vi.advanceTimersByTime(30_000);

    expect(slot.innerHTML).not.toBe(initial);
    expect(slot.innerHTML).toContain('class="clock__time"');
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderMabel, mountMabel } from './mabel.js';
import { getMockMabel } from '../lib/mabel-mock.js';

const NOW = new Date('2026-04-29T08:00:00');

describe('renderMabel', () => {
  it('renders the child name and an age', () => {
    const data = getMockMabel(NOW);
    const html = renderMabel(data, NOW);
    expect(html).toContain('Mabel');
    expect(html).toMatch(/Mabel · \d+w|Mabel · \d+d/);
  });

  it('shows time since last feed in h/m format', () => {
    const data = getMockMabel(NOW);
    const html = renderMabel(data, NOW);
    expect(html).toMatch(/\d+h \d+m/);
  });

  it('shows the last feed type and clock time', () => {
    const data = getMockMabel(NOW);
    const html = renderMabel(data, NOW);
    // last feed in the mock is a nurse 75 min ago
    expect(html).toContain('nurse');
    expect(html).toMatch(/at \d+:\d+\s?(AM|PM)/);
  });

  it('renders 24h counts for all four types', () => {
    const data = getMockMabel(NOW);
    const html = renderMabel(data, NOW);
    expect(html).toMatch(/\d+ bottles/);
    expect(html).toMatch(/\d+ nursings/);
    expect(html).toMatch(/\d+ wets/);
    expect(html).toMatch(/\d+ dirties/);
  });

  it('does not render a timeline track', () => {
    const data = getMockMabel(NOW);
    const html = renderMabel(data, NOW);
    expect(html).not.toContain('mabel__track');
    expect(html).not.toContain('mabel__event--');
  });

  it('drops events older than 24h from counts', () => {
    const data = {
      childName: 'Test',
      birthDate: '2026-04-01T00:00:00',
      events: [
        { type: 'pee', at: new Date(NOW.getTime() - 30 * 3_600_000).toISOString() },
        { type: 'pee', at: new Date(NOW.getTime() - 1 * 3_600_000).toISOString() },
      ],
    };
    const html = renderMabel(data, NOW);
    expect(html).toMatch(/1 wets/);
  });
});

describe('mountMabel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('re-renders the since-last value as time passes', () => {
    vi.setSystemTime(NOW);
    const slot = document.createElement('div');
    const data = getMockMabel(NOW);
    mountMabel(slot, data);
    const initial = slot.querySelector('.mabel__since-value').textContent;

    vi.setSystemTime(new Date(NOW.getTime() + 60 * 60_000));
    vi.advanceTimersByTime(60_000);

    const later = slot.querySelector('.mabel__since-value').textContent;
    expect(later).not.toBe(initial);
  });
});

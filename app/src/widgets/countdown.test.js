import { describe, it, expect } from 'vitest';
import { renderCountdown } from './countdown.js';
import { getMockCountdowns } from '../lib/countdown-mock.js';

const NOW = new Date('2026-04-29T08:00:00');

describe('calendar details', () => {
  it('renders location but omits the old reminder note', () => {
    const html = renderCountdown(
      [{ name: 'Mom’s birthday', date: '2026-05-19', sub: 'Atlanta', note: 'Get a card this week' }],
      NOW,
    );
    expect(html).toContain('Atlanta');
    expect(html).not.toContain('countdown__note');
    expect(html).not.toContain('Get a card this week');
  });
});

describe('renderCountdown', () => {
  it('renders up to 10 upcoming events', () => {
    const html = renderCountdown(getMockCountdowns(), NOW);
    const items = html.match(/class="countdown__item"/g) || [];
    expect(items.length).toBeLessThanOrEqual(10);
    expect(items.length).toBeGreaterThan(0);
  });

  it('orders by soonest first', () => {
    const html = renderCountdown(getMockCountdowns(), NOW);
    expect(html.indexOf('Spring Break')).toBeLessThan(html.indexOf('offsite'));
  });

  it('drops events that have already passed', () => {
    const html = renderCountdown([
      { name: 'Past event', date: '2025-01-01', sub: '' },
      { name: 'Future event', date: '2030-01-01', sub: '' },
    ], NOW);
    expect(html).not.toContain('Past event');
    expect(html).toContain('Future event');
  });

  it('formats today / tomorrow / N days', () => {
    const items = [
      { name: 'Today thing', date: '2026-04-29', sub: '' },
      { name: 'Tomorrow thing', date: '2026-04-30', sub: '' },
      { name: 'Later thing', date: '2026-05-05', sub: '' },
    ];
    const html = renderCountdown(items, NOW);
    expect(html).toContain('today');
    expect(html).toContain('tomorrow');
    expect(html).toMatch(/\d+ days/);
  });

  it('renders the absolute date with weekday + ordinal', () => {
    const html = renderCountdown([
      { name: 'X', date: '2026-05-05', sub: '' },
    ], NOW);
    expect(html).toMatch(/Tue, May 5th/);
  });

  it('shows empty state with no upcoming events', () => {
    const html = renderCountdown([], NOW);
    expect(html).toContain('Nothing on the horizon');
  });

  it('only includes Family calendar events', () => {
    const html = renderCountdown([
      { id: 'f', calendar: 'Family', title: 'Family event', startsAt: '2026-05-19', sub: 'Park' },
      { id: 't', calendar: 'Tim', title: 'Tim event', startsAt: '2026-05-19', sub: 'Office' },
    ], NOW);
    expect(html).toContain('Family event');
    expect(html).not.toContain('Tim event');
  });

  it('escapes HTML in names', () => {
    const html = renderCountdown([{ name: '<x>', date: '2030-01-01', sub: '' }], NOW);
    expect(html).not.toContain('<x>');
  });
});

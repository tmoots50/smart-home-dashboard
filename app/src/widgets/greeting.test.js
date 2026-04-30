import { describe, it, expect } from 'vitest';
import { renderGreeting } from './greeting.js';
import { getMockGreeting } from '../lib/greeting-mock.js';

describe('renderGreeting', () => {
  it('renders headline and subline', () => {
    const data = getMockGreeting(new Date('2026-04-29T08:00:00'));
    const html = renderGreeting(data);
    expect(html).toContain(data.headline);
    expect(html).toContain(data.subline);
  });

  it('rotates headline by time of day', () => {
    const morning = getMockGreeting(new Date('2026-04-29T08:00:00'));
    const evening = getMockGreeting(new Date('2026-04-29T19:00:00'));
    expect(morning.headline).not.toBe(evening.headline);
  });

  it('rotates subline by day of week', () => {
    const monday = getMockGreeting(new Date('2026-04-27T08:00:00'));
    const tuesday = getMockGreeting(new Date('2026-04-28T08:00:00'));
    expect(monday.subline).not.toBe(tuesday.subline);
  });

  it('escapes HTML', () => {
    const html = renderGreeting({ headline: '<x>', subline: '<y>' });
    expect(html).not.toContain('<x>');
    expect(html).not.toContain('<y>');
  });
});

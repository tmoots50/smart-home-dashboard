import { describe, it, expect } from 'vitest';
import { renderTraffic } from './traffic.js';
import { getMockTraffic } from '../lib/traffic-mock.js';

describe('renderTraffic', () => {
  it('renders duration, destination, and route', () => {
    const data = getMockTraffic();
    const html = renderTraffic(data);
    expect(html).toContain(`${data.durationMin} min`);
    expect(html).toContain(data.destination);
    expect(html).toContain(data.via);
  });

  it('shows positive delta when slower than typical', () => {
    const html = renderTraffic({
      destination: 'X', durationMin: 25, typicalMin: 20, via: 'Y', status: 'slow',
    });
    expect(html).toContain('+5 vs typical');
  });

  it('shows "on time" when matching typical', () => {
    const html = renderTraffic({
      destination: 'X', durationMin: 20, typicalMin: 20, via: 'Y', status: 'clear',
    });
    expect(html).toContain('on time');
  });

  it('applies status class to duration', () => {
    const html = renderTraffic(getMockTraffic());
    expect(html).toContain('traffic__duration--slow');
  });

  it('returns empty string when no data', () => {
    expect(renderTraffic(null)).toBe('');
  });
});

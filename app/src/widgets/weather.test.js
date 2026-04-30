import { describe, it, expect } from 'vitest';
import { renderWeather } from './weather.js';
import { getMockWeather } from '../lib/weather-mock.js';

describe('renderWeather', () => {
  const data = getMockWeather();

  it('renders location, temp, and condition', () => {
    const html = renderWeather(data);
    expect(html).toContain(data.location);
    expect(html).toContain(`${data.current.tempF}°`);
    expect(html).toContain(data.current.condition);
  });

  it('renders the hi/lo line', () => {
    const html = renderWeather(data);
    expect(html).toContain(`H ${data.current.hi}°`);
    expect(html).toContain(`L ${data.current.lo}°`);
  });

  it('renders one entry per forecast day', () => {
    const html = renderWeather(data);
    for (const day of data.forecast) {
      expect(html).toContain(day.label);
      expect(html).toContain(`${day.tempF}°`);
    }
  });

  it('escapes HTML in user-controlled fields', () => {
    const html = renderWeather({
      ...data,
      location: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

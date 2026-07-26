import { describe, it, expect } from 'vitest';
import { isDaytime, sunTimes } from './solar.js';

const ATLANTA = { lat: 33.7490, lon: -84.3880 };

describe('sunTimes', () => {
  it('computes sunrise before transit before sunset for Atlanta', () => {
    const times = sunTimes(new Date('2026-05-08T12:00:00-04:00'), ATLANTA.lat, ATLANTA.lon);

    expect(times.alwaysDay).toBe(false);
    expect(times.alwaysNight).toBe(false);
    expect(times.sunrise).toBeInstanceOf(Date);
    expect(times.sunset).toBeInstanceOf(Date);
    expect(times.transit).toBeInstanceOf(Date);
    expect(times.sunrise.getTime()).toBeLessThan(times.transit.getTime());
    expect(times.transit.getTime()).toBeLessThan(times.sunset.getTime());
  });

  it('keeps computed Atlanta sunrise/sunset in plausible local windows', () => {
    const times = sunTimes(new Date('2026-05-08T12:00:00-04:00'), ATLANTA.lat, ATLANTA.lon);
    const sunriseHour = times.sunrise.getHours();
    const sunsetHour = times.sunset.getHours();

    expect(sunriseHour).toBeGreaterThanOrEqual(5);
    expect(sunriseHour).toBeLessThanOrEqual(8);
    expect(sunsetHour).toBeGreaterThanOrEqual(19);
    expect(sunsetHour).toBeLessThanOrEqual(21);
  });
});

describe('isDaytime', () => {
  const sun = {
    sunrise: '2026-05-08T06:41:00-04:00',
    sunset: '2026-05-08T20:25:00-04:00',
  };

  it('uses a supplied sunrise/sunset pair when present', () => {
    expect(isDaytime(new Date('2026-05-08T06:40:59-04:00'), { ...ATLANTA, sun })).toBe(false);
    expect(isDaytime(new Date('2026-05-08T06:41:00-04:00'), { ...ATLANTA, sun })).toBe(true);
    expect(isDaytime(new Date('2026-05-08T20:24:59-04:00'), { ...ATLANTA, sun })).toBe(true);
    expect(isDaytime(new Date('2026-05-08T20:25:00-04:00'), { ...ATLANTA, sun })).toBe(false);
  });

  it('falls back to computed solar times when supplied sun strings are invalid', () => {
    expect(isDaytime(new Date('2026-05-08T12:00:00-04:00'), {
      ...ATLANTA,
      sun: { sunrise: 'bad', sunset: 'also-bad' },
    })).toBe(true);
  });
});

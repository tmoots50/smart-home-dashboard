import { describe, expect, it } from 'vitest';
import { normalizeWeather } from './weather.js';

describe('normalizeWeather', () => {
  it('keeps every remaining hour today and seven daily entries', () => {
    const hours = Array.from({ length: 24 }, (_, hour) => `2026-07-10T${String(hour).padStart(2, '0')}:00`);
    const data = normalizeWeather({
      current: { time: '2026-07-10T17:30', temperature_2m: 81, weather_code: 1 },
      hourly: {
        time: hours,
        temperature_2m: hours.map((_, i) => 70 + i),
        weather_code: hours.map(() => 1),
        precipitation_probability: hours.map(() => 0),
      },
      daily: {
        time: Array.from({ length: 7 }, (_, i) => `2026-07-${String(10 + i).padStart(2, '0')}`),
        temperature_2m_max: [81, 82, 83, 84, 85, 86, 87],
        temperature_2m_min: [61, 62, 63, 64, 65, 66, 67],
        weather_code: [1, 1, 1, 1, 1, 1, 1],
        sunrise: [], sunset: [],
      },
    }, 'Atlanta, GA');
    expect(data.hourly.map(h => h.label)).toHaveLength(7); // 17:00 through 23:00
    expect(data.forecast).toHaveLength(7);
  });
});

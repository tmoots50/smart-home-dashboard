import { describe, expect, it } from 'vitest';
import { normalizeWeather } from './weather.js';

function apiPayload(overrides = {}) {
  const hours = Array.from({ length: 24 }, (_, hour) => `2026-07-10T${String(hour).padStart(2, '0')}:00`);
  return {
    current: { time: '2026-07-10T17:30', temperature_2m: 81, weather_code: 1, ...overrides.current },
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
      ...overrides.daily,
    },
  };
}

describe('normalizeWeather', () => {
  it('keeps every remaining hour today and seven daily entries', () => {
    const data = normalizeWeather(apiPayload(), 'Atlanta, GA');
    expect(data.hourly.map(h => h.label)).toHaveLength(7); // 17:00 through 23:00
    expect(data.forecast).toHaveLength(7);
  });

  it('maps the stat-cluster fields when present', () => {
    const data = normalizeWeather(apiPayload({
      current: { apparent_temperature: 84.6, relative_humidity_2m: 61.5, wind_speed_10m: 6.4 },
      daily: { uv_index_max: [7.35], precipitation_probability_max: [20] },
    }), 'Atlanta, GA');
    expect(data.current.feelsLikeF).toBe(85);
    expect(data.current.humidity).toBe(62);
    expect(data.current.windMph).toBe(6);
    expect(data.today.uvMax).toBe(7);
    expect(data.today.rainPct).toBe(20);
  });

  it('nulls the stat fields when the API omits them', () => {
    const data = normalizeWeather(apiPayload(), 'Atlanta, GA');
    expect(data.current.feelsLikeF).toBeNull();
    expect(data.current.humidity).toBeNull();
    expect(data.current.windMph).toBeNull();
    expect(data.today.uvMax).toBeNull();
    expect(data.today.rainPct).toBeNull();
  });
});

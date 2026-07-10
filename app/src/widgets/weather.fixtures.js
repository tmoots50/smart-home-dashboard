import { getMockWeather } from '../lib/weather-mock.js';

const typical = getMockWeather();
export const states = {
  typical,
  'no-hourly': { ...typical, hourly: [] },
  overflow: {
    ...typical,
    location: 'Atlanta metropolitan area with an intentionally long location label',
    hourly: Array.from({ length: 12 }, (_, i) => ({ label: `${i + 8} AM`, tempF: 70 + i, emoji: i % 2 ? '☀️' : '⛅', precipitation: i * 7 })),
  },
};

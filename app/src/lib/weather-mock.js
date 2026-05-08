// Mock weather payload. Real source (Open-Meteo) will normalize to this shape.

export function getMockWeather() {
  return {
    location: 'Atlanta, GA',
    current: {
      tempF: 71,
      condition: 'Partly cloudy',
      hi: 78,
      lo: 58,
    },
    forecast: [
      { label: 'Tue', tempF: 80, code: 0, emoji: '☀️' },
      { label: 'Wed', tempF: 76, code: 2, emoji: '⛅' },
      { label: 'Thu', tempF: 82, code: 95, emoji: '⛈️' },
      { label: 'Fri', tempF: 79, code: 1, emoji: '🌤️' },
      { label: 'Sat', tempF: 75, code: 61, emoji: '🌧️' },
    ],
    sun: { sunrise: null, sunset: null },
  };
}

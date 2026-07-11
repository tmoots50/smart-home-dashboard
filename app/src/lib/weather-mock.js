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
    hourly: [
      { label: 'Now', tempF: 71, code: 2, emoji: '⛅', precipitation: 8 },
      { label: '9 AM', tempF: 72, code: 2, emoji: '⛅', precipitation: 8 },
      { label: '10 AM', tempF: 74, code: 1, emoji: '🌤️', precipitation: 5 },
      { label: '11 AM', tempF: 76, code: 0, emoji: '☀️', precipitation: 3 },
      { label: '12 PM', tempF: 77, code: 0, emoji: '☀️', precipitation: 2 },
      { label: '1 PM', tempF: 78, code: 1, emoji: '🌤️', precipitation: 4 },
    ],
    forecast: [
      { label: 'Mon', tempF: 78, code: 2, emoji: '⛅' },
      { label: 'Tue', tempF: 80, code: 0, emoji: '☀️' },
      { label: 'Wed', tempF: 76, code: 2, emoji: '⛅' },
      { label: 'Thu', tempF: 82, code: 95, emoji: '⛈️' },
      { label: 'Fri', tempF: 79, code: 1, emoji: '🌤️' },
      { label: 'Sat', tempF: 75, code: 61, emoji: '🌧️' },
      { label: 'Sun', tempF: 77, code: 1, emoji: '🌤️' },
    ],
    sun: { sunrise: null, sunset: null },
  };
}

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
      { label: 'Tue', tempF: 80 },
      { label: 'Wed', tempF: 76 },
      { label: 'Thu', tempF: 82 },
    ],
  };
}

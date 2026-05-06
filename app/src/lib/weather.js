// Open-Meteo client. Free, no auth. Normalizes to the same shape as weather-mock.js
// so the widget doesn't care which source it's rendering.

import { getMockWeather } from './weather-mock.js';

const CACHE_KEY = 'weather:v1';
const CACHE_TTL_MS = 15 * 60 * 1000;

// WMO weather code → short human label. Source: open-meteo.com/en/docs.
// Coarse buckets are intentional — the dashboard never needs hyper-precision.
const WMO = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (Date.now() - at > CACHE_TTL_MS) return null;
    return data;
  } catch { return null; }
}

function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); }
  catch { /* localStorage full or disabled — fine */ }
}

function normalize(api, location) {
  const c = api.current;
  const d = api.daily;
  return {
    location,
    current: {
      tempF: Math.round(c.temperature_2m),
      condition: WMO[c.weather_code] ?? '—',
      hi: Math.round(d.temperature_2m_max[0]),
      lo: Math.round(d.temperature_2m_min[0]),
    },
    forecast: d.time.slice(1, 4).map((iso, i) => ({
      label: DOW[new Date(iso + 'T12:00:00').getDay()],
      tempF: Math.round(d.temperature_2m_max[i + 1]),
    })),
  };
}

export async function fetchWeather({ lat, lon, location }) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,weather_code',
    temperature_unit: 'fahrenheit',
    timezone: 'auto',
    forecast_days: '4',
  }).toString();

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`weather: ${res.status}`);
  const data = normalize(await res.json(), location);
  writeCache(data);
  return data;
}

// Returns the freshest data we have RIGHT NOW (cache or mock) plus a promise
// that resolves with live data when (and if) the network call succeeds.
// Caller can render `initial` immediately, then swap when `live` resolves.
export function getWeather(opts) {
  const cached = readCache();
  const initial = cached ?? getMockWeather();
  const live = cached
    ? Promise.resolve(cached)
    : fetchWeather(opts).catch(() => initial);
  return { initial, live };
}

// Open-Meteo client. Free, no auth. Normalizes to the same shape as weather-mock.js
// so the widget doesn't care which source it's rendering.

import { getMockWeather } from './weather-mock.js';

const CACHE_KEY = 'weather:v5'; // v5: adds feels-like/humidity/wind + today uv/rain
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

// WMO weather code → emoji. Same code groupings as the labels above.
const WMO_EMOJI = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️',
  56: '🌧️', 57: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  66: '🌧️', 67: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️', 77: '🌨️',
  80: '🌦️', 81: '🌧️', 82: '🌧️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

export function codeToEmoji(code) { return WMO_EMOJI[code] ?? ''; }

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

export function normalizeWeather(api, location) {
  const c = api.current;
  const d = api.daily;
  const h = api.hourly;
  const firstHour = Math.max(0, h.time.findIndex(iso => iso >= c.time.slice(0, 13) + ':00'));
  const today = c.time.slice(0, 10);
  let endOfDay = firstHour;
  while (endOfDay < h.time.length && h.time[endOfDay].startsWith(today)) endOfDay += 1;
  return {
    location,
    current: {
      tempF: Math.round(c.temperature_2m),
      condition: WMO[c.weather_code] ?? '—',
      hi: Math.round(d.temperature_2m_max[0]),
      lo: Math.round(d.temperature_2m_min[0]),
      // Null-safe: absent API fields render as omitted stat cells, never "NaN°".
      feelsLikeF: c.apparent_temperature != null ? Math.round(c.apparent_temperature) : null,
      humidity: c.relative_humidity_2m != null ? Math.round(c.relative_humidity_2m) : null,
      windMph: c.wind_speed_10m != null ? Math.round(c.wind_speed_10m) : null,
    },
    // UV and rain-probability aren't available under `current` on the standard
    // forecast endpoint — today's daily max is the honest label ("UV", "Rain").
    today: {
      uvMax: d.uv_index_max?.[0] != null ? Math.round(d.uv_index_max[0]) : null,
      rainPct: d.precipitation_probability_max?.[0] ?? null,
    },
    forecast: d.time.slice(0, 7).map((iso, i) => ({
      label: DOW[new Date(iso + 'T12:00:00').getDay()],
      tempF: Math.round(d.temperature_2m_max[i]),
      code: d.weather_code[i],
      emoji: WMO_EMOJI[d.weather_code[i]] ?? '',
    })),
    hourly: h.time.slice(firstHour, endOfDay).map((iso, i) => ({
      label: i === 0 ? 'Now' : new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date(iso)),
      tempF: Math.round(h.temperature_2m[firstHour + i]),
      code: h.weather_code[firstHour + i],
      emoji: WMO_EMOJI[h.weather_code[firstHour + i]] ?? '',
      precipitation: h.precipitation_probability?.[firstHour + i] ?? 0,
    })),
    sun: {
      sunrise: d.sunrise?.[0] ?? null,
      sunset: d.sunset?.[0] ?? null,
    },
  };
}

export async function fetchWeather({ lat, lon, location }) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,weather_code,apparent_temperature,relative_humidity_2m,wind_speed_10m',
    hourly: 'temperature_2m,weather_code,precipitation_probability',
    daily: 'temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max,precipitation_probability_max',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
    forecast_days: '7',
  }).toString();

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`weather: ${res.status}`);
  const data = normalizeWeather(await res.json(), location);
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

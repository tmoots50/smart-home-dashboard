// Client for the /api/photos CF Pages Function. Returns a small random sample
// of the configured Google Photos shared album in the {src, caption} shape the
// existing widget already understands.
//
// Configuration (Vite env var):
//   VITE_DASHBOARD_TOKEN  shared bearer token between dashboard and CF Function
//
// Falls back to mock photos when unset, when the fetch fails, or when the album
// is empty — so the dashboard never has a blank photo card.

import { getMockPhotos } from './photos-mock.js';

const TOKEN = import.meta.env.VITE_DASHBOARD_TOKEN;
const CACHE_KEY = 'photos:v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h — matches the Function's edge cache TTL
const MAX_RENDER = 30; // pre-render cap, keeps the DOM light

const MONTH_FMT = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, photos } = JSON.parse(raw);
    if (Date.now() - at > CACHE_TTL_MS) return null;
    return photos;
  } catch { return null; }
}
function writeCache(photos) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), photos })); }
  catch {}
}

function shuffleAndTake(arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function toWidgetShape(apiPhotos) {
  // Append the dashboard token to image URLs as a query param. <img src=...>
  // can't carry an Authorization header, so the Function accepts ?token= as
  // a fallback for image-byte requests.
  const tokenSuffix = TOKEN ? `?token=${encodeURIComponent(TOKEN)}` : '';
  return apiPhotos.map(p => ({
    src: `${p.url}${tokenSuffix}`,
    // Drive doesn't expose user-set captions; show the creation month as a
    // soft label when available. Caption is optional in the widget.
    caption: p.takenAt ? MONTH_FMT.format(new Date(p.takenAt)) : '',
  }));
}

export async function fetchPhotos() {
  const res = await fetch('/api/photos', {
    headers: { authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`photos: ${res.status}`);
  const data = await res.json();
  const sample = shuffleAndTake(data.photos || [], MAX_RENDER);
  const widgetPhotos = toWidgetShape(sample);
  writeCache(widgetPhotos);
  return widgetPhotos;
}

// Same {initial, live} contract as getWeather / getTodos.
export function getPhotos() {
  const cached = readCache();
  const initial = cached ?? getMockPhotos();
  const live = TOKEN
    ? fetchPhotos().catch(() => initial)
    : Promise.resolve(initial);
  return { initial, live };
}

export const isConfigured = Boolean(TOKEN);

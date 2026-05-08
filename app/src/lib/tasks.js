// Client for the Google Tasks API, talking to our own /api/tasks/* CF Pages
// Functions which proxy + cache + handle the OAuth refresh-token dance. The
// dashboard never sees Google credentials; the Function holds them.
//
// Configuration (Vite env vars, ship in app/.env.local — do NOT commit):
//   VITE_DASHBOARD_TOKEN  shared bearer token between dashboard and CF Function
//
// If unset, getTodos / getGroceries fall back to mock data so local dev still
// renders something without the Functions running.

import { getMockTodos } from './todos-mock.js';
import { getMockGroceries } from './groceries-mock.js';

const TOKEN = import.meta.env.VITE_DASHBOARD_TOKEN;
const CACHE_TTL_MS = 5 * 60 * 1000;

const CACHE_KEYS = { todos: 'tasks:todos:v1', groceries: 'tasks:groceries:v1' };
const MOCK_FALLBACKS = { todos: getMockTodos, groceries: getMockGroceries };

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { at, items } = JSON.parse(raw);
    if (Date.now() - at > CACHE_TTL_MS) return null;
    return items;
  } catch { return null; }
}
function writeCache(key, items) {
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), items })); }
  catch {}
}

async function request(path, opts = {}) {
  if (!TOKEN) throw new Error('VITE_DASHBOARD_TOKEN not set');
  const res = await fetch(path, {
    ...opts,
    cache: 'no-store',
    headers: {
      ...(opts.headers || {}),
      authorization: `Bearer ${TOKEN}`,
      ...(opts.body ? { 'content-type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`tasks ${path}: ${res.status} ${detail}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Filter completed items out at the fetch layer — once an item is checked off,
// the local widget shows a strikethrough during the optimistic update, then on
// the next fetch the item disappears entirely. The bridge has no "unstrike"
// path anyway, so completed items have no reason to stick around on screen.
export async function fetchTodos() {
  const data = await request('/api/tasks/todos');
  const items = (data.items || []).filter(i => !i.done);
  writeCache(CACHE_KEYS.todos, items);
  return items;
}
export async function fetchGroceries() {
  const data = await request('/api/tasks/groceries');
  const items = (data.items || []).filter(i => !i.done);
  writeCache(CACHE_KEYS.groceries, items);
  return items;
}

export async function appendTodo(text) {
  return request('/api/tasks/todos', { method: 'POST', body: JSON.stringify({ text }) });
}
export async function appendGrocery(text) {
  return request('/api/tasks/groceries', { method: 'POST', body: JSON.stringify({ text }) });
}
export async function strikeTodo(text) {
  return request('/api/tasks/todos/strike', { method: 'POST', body: JSON.stringify({ text }) });
}
export async function strikeGrocery(text) {
  return request('/api/tasks/groceries/strike', { method: 'POST', body: JSON.stringify({ text }) });
}

// Same {initial, live} contract as getWeather / getAiMessage.
export function getTodos() { return getList('todos', fetchTodos); }
export function getGroceries() { return getList('groceries', fetchGroceries); }

function getList(key, fetcher) {
  const cached = readCache(CACHE_KEYS[key]);
  const initial = cached ?? MOCK_FALLBACKS[key]();
  const live = TOKEN
    ? fetcher().catch(() => initial)
    : Promise.resolve(initial);
  return { initial, live };
}

export const isConfigured = Boolean(TOKEN);

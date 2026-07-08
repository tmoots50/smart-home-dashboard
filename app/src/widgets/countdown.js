import { getComingUp, fetchComingUp } from '../lib/curated.js';

const MAX_ITEMS = 3;
const DAY_MS = 86_400_000;
const REFRESH_MS = 30 * 60 * 1000; // pick up the morning curation without a reload

export function renderCountdown(items, now = new Date()) {
  const today = startOfDay(now);
  const upcoming = items
    .map(it => ({ ...it, days: Math.floor((startOfDay(parseLocalDate(it.date)) - today) / DAY_MS) }))
    .filter(it => it.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, MAX_ITEMS);

  if (!upcoming.length) {
    return `
      <div class="countdown">
        <h2 class="card__title">Coming up</h2>
        <p class="muted">Nothing on the horizon.</p>
      </div>
    `;
  }

  return `
    <div class="countdown">
      <h2 class="card__title">Coming up</h2>
      <ul class="countdown__list">
        ${upcoming.map(it => `
          <li class="countdown__item">
            <div class="countdown__when">
              <span class="countdown__days">${formatDays(it.days)}</span>
              <span class="countdown__date">${formatAbsolute(it.date)}</span>
            </div>
            <div class="countdown__name">${escapeHtml(it.name)}</div>
            ${it.sub ? `<div class="countdown__sub">${escapeHtml(it.sub)}</div>` : ''}
            ${it.note ? `<div class="countdown__note">${escapeHtml(it.note)}</div>` : ''}
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

// Mounts with Hermes-curated events (falls back to cache/mock — see
// lib/curated.js). Re-reads through the day so the 6:30a curation shows up
// on the wall without a reload. Returns a teardown function.
export function mountComingUp(el) {
  const { initial, live } = getComingUp();
  el.innerHTML = renderCountdown(initial);
  live.then(items => { if (items) el.innerHTML = renderCountdown(items); });

  const id = setInterval(() => {
    fetchComingUp()
      .then(items => { el.innerHTML = renderCountdown(items); })
      .catch(() => { /* keep last good frame */ });
  }, REFRESH_MS);

  return () => clearInterval(id);
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Parse YYYY-MM-DD in local time (avoid the UTC default that shifts the day).
function parseLocalDate(s) {
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(s);
}

function formatDays(days) {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `${days} days`;
}

function formatAbsolute(dateStr) {
  const d = parseLocalDate(dateStr);
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d);
  const month = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(d);
  return `${weekday}, ${month} ${ordinal(d.getDate())}`;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

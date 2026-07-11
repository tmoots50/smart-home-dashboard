// Compact, dismissible Family-calendar agenda. The card shows up to ten items
// in its own scroll region. Two distinct gestures: tapping the check marks the
// item done (strikethrough, then it clears after a short linger — tap again to
// undo), swiping left dismisses it immediately with an Undo toast. Neither
// mutates the source Google Calendar event; state is kiosk-local.

import { getUpcoming, fetchUpcoming } from '../lib/calendar.js';
import { showToast } from './toast.js';

const MAX_ITEMS = 10;
const DAY_MS = 86_400_000;
const REFRESH_MS = 5 * 60 * 1000;
const DISMISSED_KEY = 'coming-up:dismissed:v1';
const COMPLETE_LINGER_MS = 2500;

export function renderCountdown(items, now = new Date(), dismissed = new Set(), completing = new Set()) {
  const today = startOfDay(now);
  const upcoming = (items ?? [])
    .filter(it => !it.calendar || it.calendar === 'Family')
    .map(normalizeItem)
    .filter(it => it.startsAt && !dismissed.has(it.key))
    .map(it => ({ ...it, days: Math.floor((startOfDay(parseLocalDate(it.startsAt)) - today) / DAY_MS) }))
    .filter(it => it.days >= 0)
    .sort((a, b) => parseLocalDate(a.startsAt) - parseLocalDate(b.startsAt))
    .slice(0, MAX_ITEMS);

  if (!upcoming.length) {
    return `
      <div class="countdown">
        <h2 class="card__title">Coming up · Family</h2>
        <p class="muted">Nothing on the horizon.</p>
      </div>`;
  }

  return `
    <div class="countdown">
      <h2 class="card__title">Coming up · Family</h2>
      <ul class="countdown__list">
        ${upcoming.map(it => `
          <li class="countdown__item${completing.has(it.key) ? ' countdown__item--done' : ''}" data-event-id="${escapeHtml(it.key)}">
            <button class="countdown__check" data-action="complete" aria-label="Mark done: ${escapeHtml(it.name)}"></button>
            <div class="countdown__body">
              <div class="countdown__when">
                <span class="countdown__days">${formatDays(it.days)}</span>
                <span class="countdown__date">${formatAbsolute(it.startsAt)}</span>
              </div>
              <div class="countdown__name">${escapeHtml(it.name)}</div>
              ${it.sub ? `<div class="countdown__sub">${escapeHtml(it.sub)}</div>` : ''}
            </div>
          </li>
        `).join('')}
      </ul>
    </div>`;
}

export function mountComingUp(el, source = getUpcoming(90)) {
  let items = source.initial ?? [];
  const dismissed = readDismissed();
  const completing = new Map(); // key → linger timer id
  const draw = () => { el.innerHTML = renderCountdown(items, new Date(), dismissed, new Set(completing.keys())); };

  const complete = (row) => {
    const key = row?.dataset.eventId;
    if (!key) return;
    if (completing.has(key)) {
      // Tap again during the linger = undo the completion.
      clearTimeout(completing.get(key));
      completing.delete(key);
      draw();
      return;
    }
    completing.set(key, setTimeout(() => {
      completing.delete(key);
      dismissed.add(key);
      writeDismissed(dismissed);
      draw();
    }, COMPLETE_LINGER_MS));
    draw();
  };

  const dismiss = (row) => {
    const key = row?.dataset.eventId;
    if (!key) return;
    const name = row.querySelector('.countdown__name')?.textContent ?? '';
    if (completing.has(key)) {
      clearTimeout(completing.get(key));
      completing.delete(key);
    }
    dismissed.add(key);
    writeDismissed(dismissed);
    draw();
    showToast(`Dismissed "${name}"`, {
      actionLabel: 'Undo',
      onAction: () => {
        dismissed.delete(key);
        writeDismissed(dismissed);
        draw();
      },
    });
  };

  let startX = null;
  el.addEventListener('pointerdown', e => {
    if (e.target.closest('.countdown__item')) startX = e.clientX;
  });
  el.addEventListener('pointerup', e => {
    const row = e.target.closest('.countdown__item');
    if (row && startX != null && e.clientX - startX < -60) dismiss(row);
    startX = null;
  });
  el.addEventListener('click', e => {
    if (e.target.closest('[data-action="complete"]')) complete(e.target.closest('.countdown__item'));
  });

  draw();
  source.live.then(next => { if (next) { items = next; draw(); } });
  const id = setInterval(() => {
    fetchUpcoming(90).then(next => { items = next; draw(); }).catch(() => {});
  }, REFRESH_MS);
  return () => {
    clearInterval(id);
    for (const timer of completing.values()) clearTimeout(timer);
    completing.clear();
  };
}

function normalizeItem(it) {
  const startsAt = it.startsAt || it.date;
  const name = it.title || it.name || '';
  return { ...it, startsAt, name, key: String(it.id || `${name}|${startsAt}`) };
}

function readDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')); }
  catch { return new Set(); }
}
function writeDismissed(values) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...values].slice(-100))); } catch {}
}

function startOfDay(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function parseLocalDate(s) {
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d);
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
  const s = ['th', 'st', 'nd', 'rd']; const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

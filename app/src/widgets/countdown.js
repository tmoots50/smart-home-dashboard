// Coming-Up card — full-width, two panes fed by the lib/comingup.js rules
// engine (the Hermes ranking seam):
//
//   left  "Next 4 weeks"  — chronological agenda starting AFTER this week
//   right "Plan ahead"    — 90-day planning radar (travel, offsites, vague /
//                           big-effort), importance-ordered, no dupes of left
//
// Rows are compact on purpose (≥4 visible per pane): one line of title +
// countdown/date, location wrapping underneath only when present. Category
// colors (birthday / recurring / Mabel / travel) ride the row's left edge.
//
// Two distinct gestures, unchanged from the single-pane version: tapping the
// check marks an item done (strikethrough, clears after a short linger — tap
// again to undo), swiping left dismisses immediately with an Undo toast.
// Neither mutates the source Google Calendar event; state is kiosk-local.

import { getUpcoming, fetchUpcoming } from '../lib/calendar.js';
import { rankComingUp, parseLocalDate } from '../lib/comingup.js';
import { showToast } from './toast.js';

const REFRESH_MS = 5 * 60 * 1000;
const DISMISSED_KEY = 'coming-up:dismissed:v1';
const COMPLETE_LINGER_MS = 2500;

const CATEGORY_LEGEND = [
  ['birthday', 'Birthdays'],
  ['recurring', 'Recurring'],
  ['mabel', 'Mabel'],
  ['travel', 'Travel'],
];

export function renderCountdown(items, now = new Date(), dismissed = new Set(), completing = new Set()) {
  const { left, right } = rankComingUp(items, { now });
  const visible = (list) => list.filter(it => !dismissed.has(it.key));
  const panes = [
    { label: 'Next 4 weeks', items: visible(left), empty: 'Nothing on the horizon.' },
    { label: 'Plan ahead · 90 days', items: visible(right), empty: 'Nothing needs planning.' },
  ];

  return `
    <div class="countdown countdown--split">
      <div class="card__header countdown__header">
        <h2 class="card__title">Coming Up</h2>
        <span class="countdown__legend">
          ${CATEGORY_LEGEND.map(([slug, label]) =>
            `<span class="countdown__legend-item countdown__legend-item--${slug}"><i></i>${label}</span>`).join('')}
        </span>
      </div>
      <div class="countdown__panes">
        ${panes.map(pane => `
          <section class="countdown__pane">
            <h3 class="countdown__pane-label">${escapeHtml(pane.label)}</h3>
            ${pane.items.length
              ? `<ul class="countdown__list">${pane.items.map(it => renderItem(it, completing)).join('')}</ul>`
              : `<p class="muted countdown__empty">${escapeHtml(pane.empty)}</p>`}
          </section>`).join('')}
      </div>
    </div>`;
}

function renderItem(it, completing) {
  const cls = [
    'countdown__item',
    it.category ? `countdown__item--${it.category}` : '',
    completing.has(it.key) ? 'countdown__item--done' : '',
  ].filter(Boolean).join(' ');
  return `
    <li class="${cls}" data-event-id="${escapeHtml(it.key)}">
      <button class="countdown__check" data-action="complete" aria-label="Mark done: ${escapeHtml(it.name)}"></button>
      <div class="countdown__body">
        <div class="countdown__top">
          <span class="countdown__name">${escapeHtml(it.name)}</span>
          <span class="countdown__when">
            <span class="countdown__days">${formatDays(it.days)}</span>
            <span class="countdown__date">${formatAbsolute(it.startsAt)}</span>
          </span>
        </div>
        ${it.sub ? `<div class="countdown__sub">${escapeHtml(it.sub)}</div>` : ''}
      </div>
    </li>
  `;
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

function readDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')); }
  catch { return new Set(); }
}
function writeDismissed(values) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...values].slice(-100))); } catch {}
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

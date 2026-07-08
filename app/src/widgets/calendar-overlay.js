// Expanded calendar — full-screen overlay behind the Family Calendar card's
// "See more". A 7-day agenda across every linked calendar, grouped by day,
// all-day events pinned first. Read-only on purpose: edits belong to the
// phone calendar apps (or Hermes over Telegram), not tablet forms.
//
// Same overlay conventions as widgets/home.js: scrim + panel, close via the
// ✕ button, a scrim tap, or Escape. Tapping any event row opens the
// event-detail panel for description/location drill-down.

import { openEventDetail } from './event-detail.js';

const CLOSE_SVG = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const TIME_FMT = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const DAY_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

export function openCalendarOverlay(source, { days = 7 } = {}) {
  const host = document.createElement('div');
  host.className = 'overlay';
  document.body.appendChild(host);
  document.documentElement.classList.add('has-overlay');

  let events = source.initial ?? [];

  function draw() {
    host.innerHTML = renderCalendarOverlay(events, { days });
  }

  function close() {
    document.removeEventListener('keydown', onKey);
    document.documentElement.classList.remove('has-overlay');
    host.remove();
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  host.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="close"]')) return close();
    if (e.target === host) return close(); // scrim tap
    const row = e.target.closest('[data-event]');
    if (row) {
      try { openEventDetail(JSON.parse(row.dataset.event)); } catch {}
    }
  });

  document.addEventListener('keydown', onKey);
  draw();
  source.live?.then(next => { if (next) { events = next; draw(); } });

  return close;
}

// ───── pure render ─────

export function renderCalendarOverlay(events, { days = 7, now = new Date() } = {}) {
  const groups = groupByDay(events, days, now);
  return `
    <div class="overlay__panel cal-overlay" role="dialog" aria-label="Expanded calendar">
      <div class="overlay__header">
        <h2 class="overlay__title">Next ${days} days</h2>
        <button class="overlay__close" data-action="close" aria-label="Close">${CLOSE_SVG}</button>
      </div>
      <div class="cal-overlay__body">
        ${groups.length ? groups.map(renderDay).join('')
          : '<p class="muted cal-overlay__empty">Nothing scheduled in the next week.</p>'}
      </div>
    </div>
  `;
}

function renderDay(group) {
  return `
    <section class="cal-day">
      <h3 class="cal-day__label">${escapeHtml(group.label)}</h3>
      <ul class="cal-day__list">
        ${group.events.map(ev => {
          const evtJson = escapeHtml(JSON.stringify(ev));
          return `
          <li class="cal-event" data-event="${evtJson}" role="button" tabindex="0">
            <span class="cal-event__time${ev.allDay ? ' cal-event__time--allday' : ''}">
              ${ev.allDay ? 'All day' : TIME_FMT.format(new Date(ev.startsAt))}
            </span>
            <span class="cal-event__main">
              <span class="cal-event__title">${escapeHtml(ev.title)}</span>
              ${ev.sub ? `<span class="cal-event__sub">${escapeHtml(ev.sub)}</span>` : ''}
            </span>
            <span class="cal-chip cal-chip--${slug(ev.calendar)}">${escapeHtml(ev.calendar || '')}</span>
          </li>`;
        }).join('')}
      </ul>
    </section>
  `;
}

// Bucket events into local days [today .. today+days). Multi-day all-day
// events land on their start day (or today, if already running). Within a
// day: all-day first, then by start time.
export function groupByDay(events, days, now = new Date()) {
  const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const today = dayStart(now);
  const groups = new Map(); // dayIndex → events

  for (const ev of events ?? []) {
    if (!ev?.startsAt) continue;
    const start = dayStart(parseLocalish(ev.startsAt));
    let idx = Math.round((start - today) / 86_400_000);
    if (idx < 0) idx = 0; // already-running multi-day event → show under today
    if (idx >= days) continue;
    if (!groups.has(idx)) groups.set(idx, []);
    groups.get(idx).push(ev);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([idx, evs]) => ({
      label: dayLabel(idx, today),
      events: evs.sort((a, b) => (b.allDay - a.allDay) || String(a.startsAt).localeCompare(String(b.startsAt))),
    }));
}

function dayLabel(idx, today) {
  if (idx === 0) return 'Today';
  if (idx === 1) return 'Tomorrow';
  const d = new Date(today);
  d.setDate(d.getDate() + idx);
  return DAY_FMT.format(d);
}

// All-day events arrive as bare YYYY-MM-DD — parse as LOCAL midnight, not UTC
// (new Date('2026-07-09') would shift a birthday to the previous evening in
// any western timezone).
function parseLocalish(s) {
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(s);
}

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'other';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

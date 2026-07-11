// Month-view calendar overlay — the Google/iCal-style month grid behind the
// action bar's calendar button. Read-only on purpose (edits belong to the
// phone calendar apps): day cells carry up to MAX_CHIPS colored event chips;
// chip tap → the shared event-detail panel; "+N more" or a day tap → an
// in-context day-detail sheet reusing the overlay's .cal-event rows; ‹ ›
// month nav is clamped to now ± NAV_LIMIT_MONTHS (the API serves ± 366 days).
//
// Same overlay conventions as calendar-overlay.js: scrim + panel, close via
// ✕, scrim tap, or Escape. Note the pre-existing Escape-stack quirk: every
// open overlay listens on document, so Escape collapses the whole stack —
// consistent with calendar-overlay + event-detail today.

import { openEventDetail } from './event-detail.js';

const CLOSE_SVG = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const MONTH_FMT = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const DAY_DETAIL_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
const TIME_FMT = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MAX_CHIPS = 3;
const NAV_LIMIT_MONTHS = 12;

// ───── pure grid model ─────

// Cells cover whole weeks from the Sunday on/before the 1st through the
// Saturday on/after month end (28/35/42 cells). Events bucket onto their
// LOCAL start day; an event already running when the month starts (multi-day
// span from last month) clamps onto day 1. Leading/trailing out-of-month
// cells stay chipless — their events belong to the neighboring month's view.
export function buildMonthGrid(year, month, events, now = new Date()) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
  const start = new Date(year, month, 1 - first.getDay());
  const today = dayStart(now);

  const byDay = new Map(); // 'YYYY-MM-DD' → events
  for (const ev of events ?? []) {
    if (!ev?.startsAt) continue;
    let d = dayStart(parseLocalish(ev.startsAt));
    if (d < first) {
      const end = ev.endsAt ? dayStart(parseLocalish(ev.endsAt)) : d;
      if (end <= first) continue; // ended before this month (all-day end is exclusive)
      d = first; // still running → show on day 1
    }
    const key = ymd(d);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(ev);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => (b.allDay - a.allDay) || String(a.startsAt).localeCompare(String(b.startsAt)));
  }

  const cells = [];
  for (let i = 0; i < cellCount; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const outside = date.getMonth() !== month;
    const key = ymd(date);
    const dayEvents = outside ? [] : (byDay.get(key) ?? []);
    cells.push({
      date: key,
      num: date.getDate(),
      outside,
      today: date.getTime() === today.getTime(),
      events: dayEvents,
      chips: dayEvents.slice(0, MAX_CHIPS),
      moreCount: Math.max(0, dayEvents.length - MAX_CHIPS),
    });
  }
  return { title: MONTH_FMT.format(first), cells };
}

// ───── pure render ─────

export function renderMonthCalendar(events, { year, month, now = new Date() } = {}) {
  const grid = buildMonthGrid(year, month, events, now);
  return `
    <div class="overlay__panel month-cal" role="dialog" aria-label="Month calendar">
      <div class="overlay__header">
        <h2 class="overlay__title" data-month-title>${escapeHtml(grid.title)}</h2>
        <div class="month-cal__nav">
          <button class="overlay__close" data-action="prev" aria-label="Previous month">‹</button>
          <button class="overlay__close" data-action="next" aria-label="Next month">›</button>
          <button class="overlay__close" data-action="close" aria-label="Close">${CLOSE_SVG}</button>
        </div>
      </div>
      <div class="month-cal__dow">${DOW.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="month-cal__grid">
        ${grid.cells.map(renderCell).join('')}
      </div>
    </div>
  `;
}

function renderCell(cell) {
  const cls = `month-cal__day${cell.outside ? ' is-outside' : ''}${cell.today ? ' is-today' : ''}`;
  const interactive = cell.outside ? '' : ' role="button" tabindex="0"';
  return `
    <div class="${cls}" data-date="${cell.date}"${interactive}>
      <span class="month-cal__num">${cell.num}</span>
      ${cell.chips.map(renderChip).join('')}
      ${cell.moreCount ? `<button class="month-cal__more" data-date="${cell.date}">+${cell.moreCount} more</button>` : ''}
    </div>
  `;
}

function renderChip(ev) {
  const time = ev.allDay ? '' : `<span class="month-cal__chip-time">${chipTime(ev.startsAt)}</span> `;
  return `
    <button class="month-cal__chip month-cal__chip--${slug(ev.calendar)}" data-event="${escapeHtml(JSON.stringify(ev))}">
      ${time}${escapeHtml(ev.title)}
    </button>
  `;
}

// Compact chip time: "7p", "7:30a" — full time lives in the detail panel.
function chipTime(startsAt) {
  const d = new Date(startsAt);
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes();
  const ap = d.getHours() < 12 ? 'a' : 'p';
  return m ? `${h}:${String(m).padStart(2, '0')}${ap}` : `${h}${ap}`;
}

// ───── interactive overlay ─────

// `source` must provide getMonth(year, month) → { initial, live } (the
// lib/calendar.js contract). The view supplies the source: widgets stay dumb.
export function openMonthCalendar(source, { now = new Date() } = {}) {
  const host = document.createElement('div');
  host.className = 'overlay month-cal-host';
  document.body.appendChild(host);
  document.documentElement.classList.add('has-overlay');

  const base = { year: now.getFullYear(), month: now.getMonth() };
  let view = { ...base };
  let events = [];

  function load() {
    const requested = { ...view };
    const { initial, live } = source.getMonth(view.year, view.month);
    events = initial ?? [];
    draw();
    live?.then(next => {
      // Guard against stale responses after further navigation.
      if (next && requested.year === view.year && requested.month === view.month) {
        events = next;
        draw();
      }
    }).catch(() => {});
  }

  function draw() {
    host.innerHTML = renderMonthCalendar(events, { year: view.year, month: view.month, now });
  }

  function nav(dir) {
    const delta = (view.year - base.year) * 12 + (view.month - base.month) + dir;
    if (Math.abs(delta) > NAV_LIMIT_MONTHS) return;
    const d = new Date(view.year, view.month + dir, 1);
    view = { year: d.getFullYear(), month: d.getMonth() };
    load();
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
    if (e.target.closest('[data-action="prev"]')) return nav(-1);
    if (e.target.closest('[data-action="next"]')) return nav(1);
    const chip = e.target.closest('.month-cal__chip');
    if (chip) {
      try { openEventDetail(JSON.parse(chip.dataset.event)); } catch {}
      return;
    }
    const day = e.target.closest('.month-cal__more')?.dataset.date
      ?? e.target.closest('.month-cal__day:not(.is-outside)')?.dataset.date;
    if (day) {
      const cell = buildMonthGrid(view.year, view.month, events, now)
        .cells.find(c => c.date === day);
      openDayDetail(day, cell?.events ?? []);
    }
  });

  document.addEventListener('keydown', onKey);
  load();
  return close;
}

// Small day-detail sheet over the month (z between month and event-detail).
// Reuses the expanded overlay's .cal-event row classes: 44px rows, calendar
// chips, tap → event detail.
function openDayDetail(dateStr, events) {
  const host = document.createElement('div');
  host.className = 'overlay overlay--day-detail';
  document.body.appendChild(host);

  const [y, m, d] = dateStr.split('-').map(Number);
  const title = DAY_DETAIL_FMT.format(new Date(y, m - 1, d));
  const rows = events.length
    ? `<ul class="cal-day__list">
        ${events.map(ev => `
          <li class="cal-event" data-event="${escapeHtml(JSON.stringify(ev))}" role="button" tabindex="0">
            <span class="cal-event__time${ev.allDay ? ' cal-event__time--allday' : ''}">
              ${ev.allDay ? 'All day' : TIME_FMT.format(new Date(ev.startsAt))}
            </span>
            <span class="cal-event__main">
              <span class="cal-event__title">${escapeHtml(ev.title)}</span>
              ${ev.sub ? `<span class="cal-event__sub">${escapeHtml(ev.sub)}</span>` : ''}
            </span>
            <span class="cal-chip cal-chip--${slug(ev.calendar)}">${escapeHtml(ev.calendar || '')}</span>
          </li>`).join('')}
      </ul>`
    : '<p class="muted">Nothing scheduled.</p>';

  host.innerHTML = `
    <div class="overlay__panel day-detail" role="dialog" aria-label="Day detail">
      <div class="overlay__header">
        <h2 class="overlay__title day-detail__title">${escapeHtml(title)}</h2>
        <button class="overlay__close" data-action="close" aria-label="Close">${CLOSE_SVG}</button>
      </div>
      ${rows}
    </div>
  `;

  function close() {
    document.removeEventListener('keydown', onKey);
    host.remove();
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  host.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="close"]')) return close();
    if (e.target === host) return close();
    const row = e.target.closest('[data-event]');
    if (row) {
      try { openEventDetail(JSON.parse(row.dataset.event)); } catch {}
    }
  });
  document.addEventListener('keydown', onKey);
  return close;
}

// ───── helpers ─────

function dayStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// All-day events arrive as bare YYYY-MM-DD — parse as LOCAL midnight, not UTC.
function parseLocalish(s) {
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(s);
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'other';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

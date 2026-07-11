import { getCalendar, fetchCalendar } from '../lib/calendar.js';
import { openEventDetail } from './event-detail.js';

const TIME_FMT = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});
const REFRESH_MS = 5 * 60 * 1000; // re-fetch every 5min — events can be added during the day

const DAY_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
// Per-column cap. Columns fill independently — a packed Family week must not
// starve Tim's column (the old global top-10 did exactly that). Six rows means
// five fully visible + the sixth peeking as the scroll affordance.
const MAX_PER_COLUMN = 6;

// Column order + labels for the family calendar. Each column pulls its events
// from the data section whose `label` matches. A column with no matching
// section (e.g. Caroline until her calendar is wired) renders a placeholder.
// Change the order/labels here; the widget stays in sync.
const COLUMNS = ['Family', 'Tim', 'Caroline'];

export function renderCalendar(data, now = new Date()) {
  const byLabel = new Map((data.sections ?? []).map(s => [s.label, s]));
  const columns = COLUMNS.map(label => {
    const section = byLabel.get(label);
    const events = (section?.events ?? [])
      .filter(e => parseLocalish(e.startsAt) >= now)
      .sort((a, b) => parseLocalish(a.startsAt) - parseLocalish(b.startsAt))
      .slice(0, MAX_PER_COLUMN);
    return { label, events, connected: !!section };
  });

  return `
    <div class="calendar calendar--columns">
      <div class="card__header">
        <h2 class="card__title">Family Calendar</h2>
        <button class="btn btn--text" data-overlay="calendar">See more</button>
      </div>
      <div class="calendar__grid">
        ${columns.map(col => renderColumn(col, data.nextEventId, now)).join('')}
      </div>
    </div>
  `;
}

function colSlug(label) {
  return String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function renderColumn(column, nextEventId, now) {
  return `
    <div class="calendar__column calendar__column--${colSlug(column.label)}">
      <h3 class="calendar__column-label">${escapeHtml(column.label)}</h3>
      ${columnBody(column, nextEventId, now)}
    </div>
  `;
}

function columnBody(column, nextEventId, now) {
  if (!column.connected) {
    return '<p class="calendar__empty calendar__empty--unlinked muted">Not linked yet</p>';
  }
  if (!column.events.length) {
    return '<p class="calendar__empty muted">Nothing scheduled.</p>';
  }
  return `
    <ul class="calendar__list">
      ${column.events.map(event => {
        const isNext = event.id === nextEventId;
        const cls = `calendar__event${isNext ? ' calendar__event--next' : ''}`;
        const evtJson = escapeHtml(JSON.stringify({ ...event, calendar: column.label }));
        return `
          <li class="${cls}" data-event="${evtJson}" role="button" tabindex="0">
            <span class="calendar__when">
              <span class="calendar__date">${formatDay(event.startsAt, now)}</span>
              <span class="calendar__time">${event.allDay ? 'All day' : TIME_FMT.format(parseLocalish(event.startsAt))}</span>
            </span>
            <span class="calendar__details">
              <div class="calendar__title">${escapeHtml(event.title)}</div>
              ${event.sub ? `<div class="calendar__sub">${escapeHtml(event.sub)}</div>` : ''}
            </span>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

function formatDay(value, now) {
  const date = parseLocalish(value);
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  const b = new Date(date); b.setHours(0, 0, 0, 0);
  const days = Math.round((b - a) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return DAY_FMT.format(date);
}

function parseLocalish(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

// Mounts into a slot. Renders cached/mock data instantly, then fetches live and
// swaps in. Re-fetches every REFRESH_MS so a long-running kiosk doesn't sit on
// stale data. Returns a teardown function.
export function mountCalendar(el) {
  const { initial, live } = getCalendar();
  el.innerHTML = renderCalendar(initial);
  live.then(data => { if (data) el.innerHTML = renderCalendar(data); });

  // Event delegation — survives innerHTML refreshes on the container.
  el.addEventListener('click', (e) => {
    const row = e.target.closest('[data-event]');
    if (!row) return;
    try { openEventDetail(JSON.parse(row.dataset.event)); } catch {}
  });

  const id = setInterval(() => {
    fetchCalendar()
      .then(data => { el.innerHTML = renderCalendar(data); })
      .catch(() => { /* keep showing the last good frame */ });
  }, REFRESH_MS);

  return () => clearInterval(id);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

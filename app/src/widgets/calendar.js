import { getCalendar, fetchCalendar } from '../lib/calendar.js';
import { openEventDetail } from './event-detail.js';

const TIME_FMT = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});
const REFRESH_MS = 5 * 60 * 1000; // re-fetch every 5min — events can be added during the day

// End of `now`'s local calendar day. The columns show today's remaining events
// only — nothing rolls over into tomorrow.
function endOfToday(now) {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Column order + labels for the family calendar. Each column pulls its events
// from the data section whose `label` matches. A column with no matching
// section (e.g. Caroline until her calendar is wired) renders a placeholder.
// Change the order/labels here; the widget stays in sync.
const COLUMNS = ['Tim', 'Family', 'Caroline'];

export function renderCalendar(data, now = new Date()) {
  const cutoff = endOfToday(now);
  const byLabel = new Map((data.sections ?? []).map(s => [s.label, s]));

  const columns = COLUMNS.map(label => {
    const section = byLabel.get(label);
    const events = (section?.events ?? []).filter(e => {
      const start = new Date(e.startsAt);
      return start >= now && start <= cutoff;
    });
    return { label, events, connected: !!section };
  });

  return `
    <div class="calendar calendar--columns">
      <div class="card__header">
        <h2 class="card__title">Family Calendar</h2>
        <button class="btn btn--text" data-overlay="calendar">See more</button>
      </div>
      <div class="calendar__grid">
        ${columns.map(col => renderColumn(col, data.nextEventId)).join('')}
      </div>
    </div>
  `;
}

function colSlug(label) {
  return String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function renderColumn(column, nextEventId) {
  return `
    <div class="calendar__column calendar__column--${colSlug(column.label)}">
      <h3 class="calendar__column-label">${escapeHtml(column.label)}</h3>
      ${columnBody(column, nextEventId)}
    </div>
  `;
}

function columnBody(column, nextEventId) {
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
            <span class="calendar__time">${TIME_FMT.format(new Date(event.startsAt))}</span>
            <span>
              <div class="calendar__title">${escapeHtml(event.title)}</div>
              ${event.sub ? `<div class="calendar__sub">${escapeHtml(event.sub)}</div>` : ''}
            </span>
          </li>
        `;
      }).join('')}
    </ul>
  `;
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

import { getCalendar, fetchCalendar } from '../lib/calendar.js';

const TIME_FMT = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});
const WINDOW_HOURS = 3;
const WINDOW_MS = WINDOW_HOURS * 3_600_000;
const REFRESH_MS = 5 * 60 * 1000; // re-fetch every 5min — events can be added during the day

export function renderCalendar(data, now = new Date()) {
  const cutoff = new Date(now.getTime() + WINDOW_MS);
  const sections = (data.sections ?? []).map(section => ({
    label: section.label,
    events: section.events.filter(e => {
      const start = new Date(e.startsAt);
      return start >= now && start <= cutoff;
    }),
  }));

  return `
    <div class="calendar">
      <div class="card__header">
        <h2 class="card__title">Next 3 hours</h2>
        <button class="btn btn--text" data-overlay="calendar">See more</button>
      </div>
      ${sections.map(section => renderSection(section, data.nextEventId)).join('')}
    </div>
  `;
}

function renderSection(section, nextEventId) {
  return `
    <div class="calendar__section">
      <h3 class="calendar__section-label">${escapeHtml(section.label)}</h3>
      ${section.events.length ? `
        <ul class="calendar__list">
          ${section.events.map(event => {
            const isNext = event.id === nextEventId;
            const cls = `calendar__event${isNext ? ' calendar__event--next' : ''}`;
            return `
              <li class="${cls}">
                <span class="calendar__time">${TIME_FMT.format(new Date(event.startsAt))}</span>
                <span>
                  <div class="calendar__title">${escapeHtml(event.title)}</div>
                  ${event.sub ? `<div class="calendar__sub">${escapeHtml(event.sub)}</div>` : ''}
                </span>
              </li>
            `;
          }).join('')}
        </ul>
      ` : '<p class="calendar__empty muted">Nothing scheduled.</p>'}
    </div>
  `;
}

// Mounts into a slot. Renders cached/mock data instantly, then fetches live and
// swaps in. Re-fetches every REFRESH_MS so a long-running kiosk doesn't sit on
// stale data. Returns a teardown function.
export function mountCalendar(el) {
  const { initial, live } = getCalendar();
  el.innerHTML = renderCalendar(initial);
  live.then(data => { if (data) el.innerHTML = renderCalendar(data); });

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

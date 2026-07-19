// Event detail panel — read-only drill-down for any calendar event.
// Opened by tapping a row in the dashboard card or the 7-day overlay.
// Shows title, date/time, calendar label, location, description.
// Same overlay/panel conventions as home.js and calendar-overlay.js.

const CLOSE_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const CLOCK_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
const PIN_SVG  = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
const TEXT_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="11" y2="18"/></svg>';

const TIME_FMT = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const DATE_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

function calSlug(label) {
  return String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'other';
}

function formatDateLabel(startsAt, endsAt, allDay) {
  if (allDay) {
    const start = parseLocalish(startsAt);
    return DATE_FMT.format(start) + ' · All day';
  }
  const start = new Date(startsAt);
  const date = DATE_FMT.format(start);
  const startTime = TIME_FMT.format(start);
  if (endsAt) {
    const end = new Date(endsAt);
    return `${date} · ${startTime} – ${TIME_FMT.format(end)}`;
  }
  return `${date} · ${startTime}`;
}

// All-day events arrive as bare YYYY-MM-DD — parse as LOCAL midnight.
function parseLocalish(s) {
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(s);
}

export function openEventDetail(event) {
  const host = document.createElement('div');
  host.className = 'overlay overlay--event-detail';
  document.body.appendChild(host);
  document.documentElement.classList.add('has-overlay');

  host.innerHTML = renderEventDetail(event);

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
    if (e.target === host) close();
  });

  document.addEventListener('keydown', onKey);
  return close;
}

export function renderEventDetail(event) {
  const { title = '', startsAt = '', endsAt = '', sub = '', description = '', calendar = '', allDay = false } = event;
  const dateLabel = formatDateLabel(startsAt, endsAt, allDay);
  // Chip TEXT is the true source calendar ("Tim (Work)") — this is the
  // precision surface. Chip COLOR keys off the person so work calendars keep
  // their owner's hue instead of falling through to the colorless default.
  const chipHue = calSlug(event.person || calendar);

  return `
    <div class="overlay__panel event-detail" role="dialog" aria-label="${escapeHtml(title)}">
      <div class="overlay__header">
        <h2 class="overlay__title">${escapeHtml(title)}</h2>
        <button class="overlay__close" data-action="close" aria-label="Close">${CLOSE_SVG}</button>
      </div>
      <div class="event-detail__body">
        <div class="event-detail__row">
          <span class="event-detail__icon">${CLOCK_SVG}</span>
          <span class="event-detail__text">${escapeHtml(dateLabel)}</span>
        </div>
        ${calendar ? `
        <div class="event-detail__row">
          <span class="event-detail__icon event-detail__icon--chip">
            <span class="cal-chip cal-chip--${chipHue}">${escapeHtml(calendar)}</span>
          </span>
        </div>` : ''}
        ${sub ? `
        <div class="event-detail__row">
          <span class="event-detail__icon">${PIN_SVG}</span>
          <span class="event-detail__text">${escapeHtml(sub)}</span>
        </div>` : ''}
        ${description ? `
        <div class="event-detail__row event-detail__row--description">
          <span class="event-detail__icon">${TEXT_SVG}</span>
          <span class="event-detail__text event-detail__description">${escapeHtml(description)}</span>
        </div>` : ''}
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

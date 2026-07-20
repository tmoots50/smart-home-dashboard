// Family Calendar card. Four render flavors behind one entry point — the
// 2026-07-11 feedback round: rows were "smushed", titles truncated too early,
// and the DAY of an event was too hard to pick out. Flavors:
//
//   stacked  (default) — three person columns kept; title-first rows (wraps
//              to 2 lines), day+time on a meta line under it, day bolded and
//              accent-colored when it's today.
//   rail     — three person columns; day/time column leads with a proximity
//              rail on the row edge (accent fades with distance: today →
//              tomorrow → this week → later). Titles wrap to 2 lines.
//   days     — outside the table: one full-width list grouped under day
//              headers ("Today · Fri, Jul 11"), person shown as a colored
//              dot (legend in the header). Zero day ambiguity, full titles.
//   classic  — the pre-2026-07-11 compact three-column layout, for
//              side-by-side comparison.
//
// Pick a flavor at runtime with ?calflavor=stacked|rail|days|classic (the
// view persists the choice in localStorage 'calendar:flavor').

import { getCalendar, fetchCalendar } from '../lib/calendar.js';
import { CARD_MAX_PER_COLUMN } from '../lib/comingup.js';
import { openEventDetail } from './event-detail.js';

const TIME_FMT = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});
const REFRESH_MS = 5 * 60 * 1000; // re-fetch every 5min — events can be added during the day

const DAY_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
const DAY_LONG_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
// Per-column cap. Columns fill independently — a packed Family week must not
// starve Tim's column (the old global top-10 did exactly that). Seven rows
// means six fully visible + the seventh peeking as the scroll affordance
// (card grew one row on 2026-07-19). Shared with lib/comingup.js: the
// Coming-Up left pane excludes exactly what this card shows, so the two
// widgets never repeat each other.
const MAX_PER_COLUMN = CARD_MAX_PER_COLUMN;
// The day-grouped flavor has no columns; cap the flat list instead (3×
// the per-column cap, matching the three columns it replaces).
const MAX_DAY_GROUPED = 21;

// Column order + labels for the family calendar. Each column pulls its events
// from the data section whose `label` matches. A column with no matching
// section (e.g. Caroline until her calendar is wired) renders a placeholder.
// Change the order/labels here; the widget stays in sync.
const COLUMNS = ['Family', 'Tim', 'Caroline'];

export const FLAVORS = ['stacked', 'rail', 'days', 'classic'];
export const DEFAULT_FLAVOR = 'stacked';

export function renderCalendar(data, now = new Date(), { flavor = DEFAULT_FLAVOR } = {}) {
  if (!FLAVORS.includes(flavor)) flavor = DEFAULT_FLAVOR;
  if (flavor === 'days') return renderDayGrouped(data, now);
  return renderColumns(data, now, flavor);
}

// ── column flavors (stacked / rail / classic) ──

function renderColumns(data, now, flavor) {
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
    <div class="calendar calendar--columns calendar--${flavor}">
      <div class="card__header">
        <h2 class="card__title">Family Calendar</h2>
        <button class="btn btn--text" data-overlay="calendar">See more</button>
      </div>
      <div class="calendar__grid">
        ${columns.map(col => renderColumn(col, data.nextEventId, now, flavor)).join('')}
      </div>
    </div>
  `;
}

function colSlug(label) {
  return String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function renderColumn(column, nextEventId, now, flavor) {
  return `
    <div class="calendar__column calendar__column--${colSlug(column.label)}">
      <h3 class="calendar__column-label">${escapeHtml(column.label)}</h3>
      ${columnBody(column, nextEventId, now, flavor)}
    </div>
  `;
}

function columnBody(column, nextEventId, now, flavor) {
  if (!column.connected) {
    return '<p class="calendar__empty calendar__empty--unlinked muted">Not linked yet</p>';
  }
  if (!column.events.length) {
    return '<p class="calendar__empty muted">Nothing scheduled.</p>';
  }
  const row = flavor === 'stacked' ? renderStackedRow
    : flavor === 'rail' ? renderRailRow
    : renderClassicRow;
  return `
    <ul class="calendar__list">
      ${column.events.map(event => row(event, column.label, nextEventId, now)).join('')}
    </ul>
  `;
}

function rowAttrs(event, label, nextEventId, extraClass = '') {
  const isNext = event.id === nextEventId;
  // Work rows carry a colored left edge (--work) instead of the old text
  // pill — matches the month calendar's edge-marks-the-source convention.
  // --next comes last so the next-up accent wins when a work row is next.
  const work = event.kind === 'work' ? ' calendar__event--work' : '';
  const cls = `calendar__event${extraClass}${work}${isNext ? ' calendar__event--next' : ''}`;
  // Sections are person-keyed, so `label` is the person, NOT the source
  // calendar. Preserve the event's own calendar ("Tim (Work)") — event-detail
  // and any future edit routing need the true source, not the column name.
  const evtJson = escapeHtml(JSON.stringify({
    ...event,
    calendar: event.calendar || label,
    person: event.person || label,
  }));
  return `class="${cls}" data-event="${evtJson}" role="button" tabindex="0"`;
}

function renderClassicRow(event, label, nextEventId, now) {
  return `
    <li ${rowAttrs(event, label, nextEventId)}>
      <span class="calendar__when">
        <span class="calendar__date">${formatDay(event.startsAt, now)}</span>
        <span class="calendar__time">${eventTime(event)}</span>
      </span>
      <span class="calendar__details">
        <div class="calendar__title">${escapeHtml(event.title)}</div>
        ${event.sub ? `<div class="calendar__sub">${escapeHtml(event.sub)}</div>` : ''}
      </span>
    </li>
  `;
}

// Title first (2-line wrap), then a day-led meta line. The day is the element
// Tim scans for, so it gets weight; today additionally gets the accent.
function renderStackedRow(event, label, nextEventId, now) {
  const today = dayIndex(event.startsAt, now) === 0;
  return `
    <li ${rowAttrs(event, label, nextEventId, ' calendar__event--stacked')}>
      <div class="calendar__title">${escapeHtml(event.title)}</div>
      ${event.sub ? `<div class="calendar__sub">${escapeHtml(event.sub)}</div>` : ''}
      <div class="calendar__meta">
        <span class="calendar__date${today ? ' calendar__date--today' : ''}">${formatDay(event.startsAt, now)}</span>
        <span class="calendar__meta-sep">·</span>
        <span class="calendar__time">${eventTime(event)}</span>
      </div>
    </li>
  `;
}

// Day/time column leads; the row edge carries a proximity rail (accent fades
// with distance so "how soon" reads at arm's length without new hues).
function renderRailRow(event, label, nextEventId, now) {
  const idx = dayIndex(event.startsAt, now);
  const bucket = idx === 0 ? 'd0' : idx === 1 ? 'd1' : idx <= 6 ? 'dweek' : 'dlater';
  return `
    <li ${rowAttrs(event, label, nextEventId, ` calendar__event--rail calendar__event--${bucket}`)}>
      <span class="calendar__when">
        <span class="calendar__date">${formatDay(event.startsAt, now)}</span>
        <span class="calendar__time">${eventTime(event)}</span>
      </span>
      <span class="calendar__details">
        <div class="calendar__title">${escapeHtml(event.title)}</div>
        ${event.sub ? `<div class="calendar__sub">${escapeHtml(event.sub)}</div>` : ''}
      </span>
    </li>
  `;
}

// ── day-grouped flavor ──

function renderDayGrouped(data, now) {
  const events = (data.sections ?? [])
    // Keep the event's true source calendar; backfill person from the
    // (person-keyed) section label for legacy events that predate the field.
    .flatMap(s => (s.events ?? []).map(e => ({ ...e, calendar: e.calendar || s.label, person: e.person || s.label })))
    .filter(e => parseLocalish(e.startsAt) >= now)
    .sort((a, b) => parseLocalish(a.startsAt) - parseLocalish(b.startsAt))
    .slice(0, MAX_DAY_GROUPED);

  const groups = [];
  for (const event of events) {
    const idx = dayIndex(event.startsAt, now);
    const last = groups[groups.length - 1];
    if (last && last.idx === idx) last.events.push(event);
    else groups.push({ idx, label: dayGroupLabel(event.startsAt, idx), events: [event] });
  }

  const body = groups.length
    ? groups.map(group => `
        <section class="calendar__daygroup">
          <h3 class="calendar__day-label${group.idx === 0 ? ' is-today' : ''}">${escapeHtml(group.label)}</h3>
          <ul class="calendar__list calendar__list--flat">
            ${group.events.map(event => `
              <li ${rowAttrs(event, event.person, data.nextEventId, ' calendar__event--flat')}>
                <i class="calendar__dot calendar__dot--${colSlug(event.person)}"></i>
                <span class="calendar__time">${eventTime(event)}</span>
                <span class="calendar__details">
                  <span class="calendar__title">${escapeHtml(event.title)}</span>
                  ${event.sub ? `<span class="calendar__sub">${escapeHtml(event.sub)}</span>` : ''}
                </span>
              </li>
            `).join('')}
          </ul>
        </section>
      `).join('')
    : '<p class="calendar__empty muted">Nothing scheduled.</p>';

  return `
    <div class="calendar calendar--days">
      <div class="card__header">
        <h2 class="card__title">Family Calendar</h2>
        <div class="card__header-actions">
          <span class="calendar__legend">
            ${COLUMNS.map(label => `
              <span class="calendar__legend-item">
                <i class="calendar__dot calendar__dot--${colSlug(label)}"></i>${escapeHtml(label)}
              </span>`).join('')}
          </span>
          <button class="btn btn--text" data-overlay="calendar">See more</button>
        </div>
      </div>
      <div class="calendar__daylist">${body}</div>
    </div>
  `;
}

// ── shared helpers ──

function eventTime(event) {
  return event.allDay ? 'All day' : TIME_FMT.format(parseLocalish(event.startsAt));
}

function dayIndex(value, now) {
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  const b = parseLocalish(value); b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86_400_000);
}

function formatDay(value, now) {
  const days = dayIndex(value, now);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return DAY_FMT.format(parseLocalish(value));
}

function dayGroupLabel(value, idx) {
  const full = DAY_LONG_FMT.format(parseLocalish(value));
  if (idx === 0) return `Today · ${full}`;
  if (idx === 1) return `Tomorrow · ${full}`;
  return full;
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
export function mountCalendar(el, { flavor = DEFAULT_FLAVOR } = {}) {
  const { initial, live } = getCalendar();
  el.innerHTML = renderCalendar(initial, new Date(), { flavor });
  live.then(data => { if (data) el.innerHTML = renderCalendar(data, new Date(), { flavor }); });

  // Event delegation — survives innerHTML refreshes on the container.
  el.addEventListener('click', (e) => {
    const row = e.target.closest('[data-event]');
    if (!row) return;
    try { openEventDetail(JSON.parse(row.dataset.event)); } catch {}
  });

  const id = setInterval(() => {
    fetchCalendar()
      .then(data => { el.innerHTML = renderCalendar(data, new Date(), { flavor }); })
      .catch(() => { /* keep showing the last good frame */ });
  }, REFRESH_MS);

  return () => clearInterval(id);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

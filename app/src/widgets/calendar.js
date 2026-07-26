// Family Calendar card. Five render flavors behind one entry point. Flavors:
//
//   week     (default) — a rolling 5-day time grid: five day columns starting
//              at today, hours as rows, events drawn as proportional blocks.
//              ‹ › page the window a full 5 days at a time and a tap on the
//              date range snaps back to today (see mountCalendar). 8 AM–6 PM
//              sits in the card's fixed viewport; the grid scrolls to reach
//              5 AM–midnight without growing the module. All-day / multi-day
//              events ride a pinned band above the grid. One calendar → one
//              color (the theme accent).
//   stacked  — three person columns kept; title-first rows (wraps to 2
//              lines), day+time on a meta line under it, day bolded and
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
// Pick a flavor at runtime with ?calflavor=week|stacked|rail|days|classic
// (the view persists the choice in localStorage 'calendar:flavor').

import { getCalendar, fetchCalendar, getRange, fetchRange } from '../lib/calendar.js';
import { CARD_MAX_PER_COLUMN } from '../lib/comingup.js';
import { visibleRoster, isHiddenEvent } from '../lib/calendar-people.js';
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
// from the data section whose `label` matches. The household roster is
// Family/Tim/Caroline, but Tim and Caroline are hidden from every calendar
// surface (see lib/calendar-people.js) — so the card renders the Family
// column only. Their sections/events are dropped, not merged.
const COLUMNS = visibleRoster(['Family', 'Tim', 'Caroline']);

export const FLAVORS = ['week', 'stacked', 'rail', 'days', 'classic'];
// renderCalendar's programmatic fallback. The WALL default is 'week' — set in
// mountCalendar so a fresh kiosk lands on the time grid — but renderCalendar
// keeps 'stacked' as its no-arg fallback so direct callers/fixtures that
// predate the week grid render unchanged.
export const DEFAULT_FLAVOR = 'stacked';

export function renderCalendar(data, now = new Date(), { flavor = DEFAULT_FLAVOR, offsetDays = 0 } = {}) {
  if (!FLAVORS.includes(flavor)) flavor = DEFAULT_FLAVOR;
  if (flavor === 'week') return renderWeek(flattenEvents(data), now, { offsetDays });
  if (flavor === 'days') return renderDayGrouped(data, now);
  return renderColumns(data, now, flavor);
}

// Flatten the person-keyed sections shape into a flat event list, backfilling
// the source calendar + person like renderDayGrouped does. The week grid is
// day/time-keyed, not person-keyed, so it works off one merged stream.
function flattenEvents(data) {
  return (data.sections ?? [])
    .flatMap(s => (s.events ?? []).map(e => ({ ...e, calendar: e.calendar || s.label, person: e.person || s.label })));
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

  // Track count follows the visible columns — with Tim and Caroline hidden the
  // card is a single Family column, and a fixed 3-track grid would strand it in
  // the left third. One column → full width; the layout scales back up on its
  // own if a person is ever un-hidden.
  return `
    <div class="calendar calendar--columns calendar--${flavor}">
      <div class="card__header">
        <h2 class="card__title">Family Calendar</h2>
        <button class="btn btn--text" data-overlay="calendar">See more</button>
      </div>
      <div class="calendar__grid" style="grid-template-columns: repeat(${columns.length}, minmax(0, 1fr))">
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
    // This flavor bypasses the column filter (no columns), so drop hidden
    // people's events here too — the legend already excludes them.
    .filter(e => !isHiddenEvent(e))
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

// ── flavor: week (5-day rolling time grid) ──
//
// The wall default. Blocks are deliberately NOT <button>/role="button": on a
// fixed-height card the 8 AM–6 PM requirement forces sub-44px blocks, which
// can't meet the tap floor. Following the month-calendar precedent, blocks are
// glanceable and tap via [data-event] delegation, while the 44px interaction
// (See more → full overlay) stays large. Same reason the QA tap audit passes.
// The ‹ › nav buttons and the date-range/Today control DO carry the 44px hit
// floor — they're real touch targets and are policed by the tap audit.

const WINDOW_DAYS = 5;            // day columns shown at once
const WINDOW_STEP = WINDOW_DAYS;  // ‹ › shift a full, non-overlapping window
// Navigation bounds (in days from today). One window back, ~five ahead — far
// enough for the wall's "what's coming" glance; the month overlay ("See more")
// owns anything further out. Both are multiples of WINDOW_STEP so paging stays
// window-aligned and today is only ever in view at offset 0.
const WEEK_MIN_OFFSET = -WINDOW_STEP;
const WEEK_MAX_OFFSET = WINDOW_STEP * 5;
const WEEK_START_HOUR = 5;        // grid top (5 AM)
const WEEK_END_HOUR = 24;         // grid bottom (midnight)
export const WEEK_OPEN_HOUR = 8;  // scrolled-to hour on mount → 8 AM–6 PM visible
const WEEK_RANGE_MIN = (WEEK_END_HOUR - WEEK_START_HOUR) * 60;
const WEEK_DOW_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const WEEK_HOUR_FMT = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });
// Nav range label, e.g. "Jul 15 – 19" (same month) or "Jul 29 – Aug 2".
const WEEK_RANGE_MON_DAY = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const WEEK_RANGE_DAY = new Intl.DateTimeFormat(undefined, { day: 'numeric' });

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function minutesOfDay(value) { const d = parseLocalish(value); return d.getHours() * 60 + d.getMinutes(); }

// Whole days from a start-of-day anchor to `value`'s start-of-day.
function dayOffsetFrom(anchor, value) {
  return Math.round((startOfDay(parseLocalish(value)) - anchor) / 86_400_000);
}

function weekRangeLabel(start, end) {
  return start.getMonth() === end.getMonth()
    ? `${WEEK_RANGE_MON_DAY.format(start)} – ${WEEK_RANGE_DAY.format(end)}`
    : `${WEEK_RANGE_MON_DAY.format(start)} – ${WEEK_RANGE_MON_DAY.format(end)}`;
}

function weekEventAttrs(event) {
  const json = escapeHtml(JSON.stringify({
    ...event,
    calendar: event.calendar || 'Family',
    person: event.person || event.calendar || 'Family',
  }));
  return `data-event="${json}"`;
}

// `offsetDays` shifts the visible window off today (0 = today-anchored). It's a
// multiple of WINDOW_STEP in practice, but the render is robust to any value.
export function renderWeek(events, now = new Date(), { offsetDays = 0 } = {}) {
  const today0 = startOfDay(now);
  const windowStart = addDays(today0, offsetDays);
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(windowStart, i));
  // Today's column index within the window — negative or ≥WINDOW_DAYS when
  // today isn't in view (a paged window), so no now-line/highlight renders.
  const todayIdx = Math.round((today0 - windowStart) / 86_400_000);

  const visible = (events ?? []).filter(e => !isHiddenEvent(e));

  // next-up highlight: soonest timed event from now (all-day events excluded).
  const nowMs = now.getTime();
  let nextId = null, nextMs = Infinity;
  for (const e of visible) {
    if (e.allDay) continue;
    const t = parseLocalish(e.startsAt).getTime();
    if (t >= nowMs && t < nextMs) { nextMs = t; nextId = e.id; }
  }

  const allDay = [];
  const timedByDay = Array.from({ length: WINDOW_DAYS }, () => []);
  for (const e of visible) {
    if (e.allDay) { allDay.push(e); continue; }
    const idx = dayOffsetFrom(windowStart, e.startsAt);
    if (idx >= 0 && idx < WINDOW_DAYS) timedByDay[idx].push(e);
  }

  const head = `
    <div class="calweek__head">
      <div class="calweek__corner"></div>
      ${days.map((d, i) => `
        <div class="calweek__dow${i === todayIdx ? ' is-today' : ''}">
          <span class="calweek__dow-name">${escapeHtml(WEEK_DOW_FMT.format(d))}</span>
          <span class="calweek__dow-num">${d.getDate()}</span>
        </div>`).join('')}
    </div>`;

  const cols = days.map((_, i) => renderDayColumn(timedByDay[i], i === todayIdx ? now : null, nextId)).join('');

  return `
    <div class="calendar calendar--week">
      <div class="card__header">
        <h2 class="card__title">Family Calendar</h2>
        ${renderWeekNav(windowStart, days[days.length - 1], offsetDays)}
        <button class="btn btn--text" data-overlay="calendar">See more</button>
      </div>
      <div class="calweek">
        ${head}
        ${renderAllDayBand(allDay, windowStart)}
        <div class="calweek__scroll">
          <div class="calweek__grid">
            ${renderHourGutter()}
            ${cols}
          </div>
        </div>
      </div>
    </div>`;
}

// ‹ [date range] › — the arrows page the window a full WINDOW_STEP; the center
// label shows the visible range and, when paged off today (is-away), taps back
// to today. All three carry the 44px hit floor (real touch targets → the tap
// audit polices them, unlike the glanceable event blocks).
function renderWeekNav(windowStart, windowEnd, offsetDays) {
  const canPrev = offsetDays > WEEK_MIN_OFFSET;
  const canNext = offsetDays < WEEK_MAX_OFFSET;
  const away = offsetDays !== 0;
  const label = weekRangeLabel(windowStart, windowEnd);
  return `
    <div class="calweek__nav">
      <button class="calweek__nav-btn" data-calnav="prev" aria-label="Earlier days"${canPrev ? '' : ' disabled'}>‹</button>
      <button class="calweek__nav-label${away ? ' is-away' : ''}" data-calnav="today" aria-label="${away ? 'Back to today' : 'Showing today'}">${escapeHtml(label)}</button>
      <button class="calweek__nav-btn" data-calnav="next" aria-label="Later days"${canNext ? '' : ' disabled'}>›</button>
    </div>`;
}

function renderHourGutter() {
  let labels = '';
  for (let h = WEEK_START_HOUR; h < WEEK_END_HOUR; h++) {
    const top = ((h - WEEK_START_HOUR) * 60) / WEEK_RANGE_MIN * 100;
    labels += `<span class="calweek__hour" style="top:${top.toFixed(2)}%">${escapeHtml(WEEK_HOUR_FMT.format(new Date(2000, 0, 1, h)))}</span>`;
  }
  return `<div class="calweek__gutter">${labels}</div>`;
}

function renderDayColumn(dayEvents, nowForCol, nextId) {
  const rangeStart = WEEK_START_HOUR * 60, rangeEnd = WEEK_END_HOUR * 60;
  const laid = packLanes(dayEvents.map(e => {
    let start = minutesOfDay(e.startsAt);
    let end = e.endsAt ? minutesOfDay(e.endsAt) : start + 30;
    if (end <= start) end = start + 30; // guard bad/zero-length data
    return { e, start, end };
  }));

  const blocks = laid.map(({ e, start, end, lane, lanes }) => {
    const s = Math.max(start, rangeStart), en = Math.min(end, rangeEnd);
    if (en <= s) return ''; // fully outside the visible range
    const top = (s - rangeStart) / WEEK_RANGE_MIN * 100;
    const height = (en - s) / WEEK_RANGE_MIN * 100;
    const isNext = e.id != null && e.id === nextId;
    return `<div class="calweek__event${isNext ? ' calweek__event--next' : ''}"
      style="top:${top.toFixed(2)}%;height:${height.toFixed(2)}%;left:${(lane * 100 / lanes).toFixed(2)}%;width:${(100 / lanes).toFixed(2)}%"
      ${weekEventAttrs(e)} tabindex="0">
      <span class="calweek__event-time">${eventTime(e)}</span>
      <span class="calweek__title">${escapeHtml(e.title)}</span>
    </div>`;
  }).join('');

  let nowLine = '';
  if (nowForCol) {
    const m = nowForCol.getHours() * 60 + nowForCol.getMinutes();
    if (m >= rangeStart && m <= rangeEnd) {
      const top = (m - rangeStart) / WEEK_RANGE_MIN * 100;
      nowLine = `<div class="calweek__now" style="top:${top.toFixed(2)}%"><span class="calweek__now-dot"></span></div>`;
    }
  }

  return `<div class="calweek__col${nowForCol ? ' is-today' : ''}">${nowLine}${blocks}</div>`;
}

// Greedy interval packing: events that overlap in time split the column width
// into side-by-side lanes; a gap flushes the cluster so the next run reclaims
// full width. Returns each item with its {lane, lanes}.
function packLanes(items) {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const out = [];
  let columns = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const lanes = columns.length;
    columns.forEach((col, lane) => col.forEach(it => out.push({ ...it, lane, lanes })));
    columns = [];
  };
  for (const it of sorted) {
    if (it.start >= clusterEnd && columns.length) flush();
    let placed = false;
    for (const col of columns) {
      if (col[col.length - 1].end <= it.start) { col.push(it); placed = true; break; }
    }
    if (!placed) columns.push([it]);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  flush();
  return out;
}

// All-day / multi-day events ride a pinned band above the grid, as spanning
// bars across the day columns they cover. Non-overlapping bars share a row;
// the band is height-capped (CSS) so a rare pile-up clips rather than growing
// the module — the full list lives behind "See more".
function renderAllDayBand(allDay, windowStart) {
  const bars = [];
  for (const e of allDay) {
    const s = startOfDay(parseLocalish(e.startsAt));
    // All-day endsAt is the exclusive next-day boundary (Google convention).
    const endExcl = e.endsAt ? startOfDay(parseLocalish(e.endsAt)) : new Date(s.getTime() + 86_400_000);
    let idxStart = Math.round((s - windowStart) / 86_400_000);
    let idxEndExcl = Math.round((endExcl - windowStart) / 86_400_000);
    if (idxEndExcl <= idxStart) idxEndExcl = idxStart + 1;
    if (idxEndExcl <= 0 || idxStart >= WINDOW_DAYS) continue; // outside this window
    bars.push({ e, colStart: Math.max(0, idxStart), colEndExcl: Math.min(WINDOW_DAYS, idxEndExcl) });
  }
  if (!bars.length) return ''; // no band → the scroll area flexes to fill

  const rows = packAllDayRows(bars);
  const cells = rows.map(({ e, colStart, colEndExcl, row }) =>
    `<div class="calweek__bar" style="grid-column:${2 + colStart} / ${2 + colEndExcl};grid-row:${row + 1}" ${weekEventAttrs(e)} tabindex="0">${escapeHtml(e.title)}</div>`,
  ).join('');
  return `<div class="calweek__allday"><div class="calweek__corner"><span>all-day</span></div>${cells}</div>`;
}

// Horizontal lane packing for the all-day band: a bar joins the first row it
// doesn't collide with (by column span), else opens a new row.
function packAllDayRows(bars) {
  const sorted = [...bars].sort((a, b) => a.colStart - b.colStart || a.colEndExcl - b.colEndExcl);
  const rows = []; // each row: list of placed bars
  const out = [];
  for (const bar of sorted) {
    let row = rows.findIndex(r => r.every(b => bar.colStart >= b.colEndExcl || bar.colEndExcl <= b.colStart));
    if (row === -1) { row = rows.length; rows.push([]); }
    rows[row].push(bar);
    out.push({ ...bar, row });
  }
  return out;
}

// Scroll the grid so 8 AM sits at the top of the viewport (→ 8 AM–8 PM shown).
// Called after every (re)render because innerHTML resets scrollTop.
export function scrollWeekToOpen(el) {
  const scroll = el.querySelector('.calweek__scroll');
  if (!scroll) return;
  const frac = (WEEK_OPEN_HOUR - WEEK_START_HOUR) / (WEEK_END_HOUR - WEEK_START_HOUR);
  scroll.scrollTop = scroll.scrollHeight * frac;
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
//
// The wall defaults to the week grid; the list flavors remain reachable with
// ?calflavor=stacked|rail|days|classic.
export function mountCalendar(el, { flavor = 'week' } = {}) {
  if (!FLAVORS.includes(flavor)) flavor = 'week';

  // Event delegation — survives innerHTML refreshes on the container. Shared by
  // every flavor (blocks and rows both carry [data-event]).
  el.addEventListener('click', (e) => {
    const row = e.target.closest('[data-event]');
    if (!row) return;
    try { openEventDetail(JSON.parse(row.dataset.event)); } catch {}
  });

  // Week grid: a rolling 5-day window over a WIDER fetched range so ‹ › paging
  // is instant — a client-side re-slice, no network hop, no flicker. The range
  // is recomputed against "today" on each refresh, so a long-running kiosk that
  // crosses midnight re-anchors itself. Refresh keeps the current offset (the
  // Today control is the only reset — no surprise snap-backs on the wall).
  if (flavor === 'week') {
    let offsetDays = 0;
    let events = [];
    const paint = () => { el.innerHTML = renderWeek(events, new Date(), { offsetDays }); scrollWeekToOpen(el); };
    // [timeMin, timeMax] covering every reachable window, with today re-read
    // each call so the range tracks the real date on a kiosk left running.
    const rangeArgs = () => {
      const t0 = startOfDay(new Date());
      return [addDays(t0, WEEK_MIN_OFFSET).toISOString(), addDays(t0, WEEK_MAX_OFFSET + WINDOW_DAYS).toISOString()];
    };

    const { initial, live } = getRange(...rangeArgs());
    events = initial; paint();
    live.then(evs => { if (evs) { events = evs; paint(); } });

    // ‹ › page a full window; a tap on the range label returns to today. Its
    // own listener — the shared [data-event] one above ignores nav buttons.
    el.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-calnav]');
      if (!nav) return;
      const dir = nav.dataset.calnav;
      if (dir === 'today') offsetDays = 0;
      else if (dir === 'prev') offsetDays = Math.max(WEEK_MIN_OFFSET, offsetDays - WINDOW_STEP);
      else if (dir === 'next') offsetDays = Math.min(WEEK_MAX_OFFSET, offsetDays + WINDOW_STEP);
      paint();
    });

    const id = setInterval(() => {
      fetchRange(...rangeArgs()).then(evs => { events = evs; paint(); }).catch(() => { /* keep the last good frame */ });
    }, REFRESH_MS);
    return () => clearInterval(id);
  }

  const { initial, live } = getCalendar();
  el.innerHTML = renderCalendar(initial, new Date(), { flavor });
  live.then(data => { if (data) el.innerHTML = renderCalendar(data, new Date(), { flavor }); });

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

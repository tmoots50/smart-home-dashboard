// Expanded calendar — full-screen overlay behind the Family Calendar card's
// "See more". A 7-day agenda across every linked calendar, grouped BY PERSON
// by default (each family member's week reads as one chronological column —
// "what does Caroline's week look like?" in one glance). groupBy:'day' keeps
// the original day-bucketed view. Read-only on purpose: edits belong to the
// phone calendar apps (or Hermes over Telegram), not tablet forms.
//
// Empty week: instead of a lone "nothing scheduled" line in a full-screen
// panel, we surface the next events BEYOND the 7-day window ("Coming up"),
// capped at EMPTY_NEXT_MAX — the cap is grounded in a QA-harness measurement,
// not a guess (see the constant's comment). The briefing feeds a 30-day
// window so those later events exist to show.
//
// Same overlay conventions as widgets/home.js: scrim + panel, close via the
// ✕ button, a scrim tap, or Escape. Tapping any event row opens the
// event-detail panel for description/location drill-down.

import { openEventDetail } from './event-detail.js';

const CLOSE_SVG = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const TIME_FMT = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const DAY_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
const WEEKDAY_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const MONTHDAY_FMT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

// Column order of the Family Calendar card (calendar.js COLUMNS) — person
// sections keep the same household order; unknown labels sort after, A→Z.
const PERSON_ORDER = ['Family', 'Tim', 'Caroline'];

// Ideal-N for the empty-week "Coming up" list, empirically derived: the QA
// harness measured 29 event rows fully visible before the canvas fold
// (1080×1920) starts scrolling — the hard ceiling. 12 fills the "so when IS
// the next thing?" gap while keeping the panel airy (~40% of ceiling).
// Re-measure via tests/qa/calendar-overlay.spec.js if row height changes.
const EMPTY_NEXT_MAX = 12;

export function openCalendarOverlay(source, { days = 7, groupBy = 'person' } = {}) {
  const host = document.createElement('div');
  host.className = 'overlay';
  document.body.appendChild(host);
  document.documentElement.classList.add('has-overlay');

  let events = source.initial ?? [];

  function draw() {
    host.innerHTML = renderCalendarOverlay(events, { days, groupBy });
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

export function renderCalendarOverlay(events, { days = 7, now = new Date(), groupBy = 'person' } = {}) {
  const { within, later } = splitByHorizon(events, days, now);

  let body;
  if (!within.length) {
    body = renderEmpty(later, now);
  } else if (groupBy === 'day') {
    body = groupByDay(within, days, now).map(renderDay).join('');
  } else {
    body = groupByPerson(within, days, now).map(g => renderPerson(g, now)).join('');
  }

  return `
    <div class="overlay__panel cal-overlay" role="dialog" aria-label="Expanded calendar">
      <div class="overlay__header">
        <h2 class="overlay__title">Next ${days} days</h2>
        <button class="overlay__close" data-action="close" aria-label="Close">${CLOSE_SVG}</button>
      </div>
      <div class="cal-overlay__body">
        ${body}
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

// One person's week: chronological rows with an inline day column. No chip —
// the section header already names the person.
function renderPerson(group, now) {
  const today = dayStart(now);
  return `
    <section class="cal-person cal-person--${slug(group.person)}">
      <h3 class="cal-day__label cal-person__label">${escapeHtml(group.person)}</h3>
      <ul class="cal-day__list">
        ${group.events.map(ev => renderDatedRow(ev, nearDayLabel(ev, today))).join('')}
      </ul>
    </section>
  `;
}

// Empty week. `later` = events beyond the horizon, soonest first.
function renderEmpty(later, now) {
  const upNext = (later ?? []).slice(0, EMPTY_NEXT_MAX);
  const empty = '<p class="muted cal-overlay__empty">Nothing scheduled in the next week.</p>';
  if (!upNext.length) return empty;
  return `
    ${empty}
    <section class="cal-coming">
      <h3 class="cal-day__label">Coming up</h3>
      <ul class="cal-day__list">
        ${upNext.map(ev => renderDatedRow(ev, MONTHDAY_FMT.format(parseLocalish(ev.startsAt)), { chip: true })).join('')}
      </ul>
    </section>
  `;
}

// Shared row for person sections and the Coming-up list: [day] [time] [main]
// (+ optional calendar chip when the section doesn't already name the person).
function renderDatedRow(ev, dayText, { chip = false } = {}) {
  const evtJson = escapeHtml(JSON.stringify(ev));
  return `
    <li class="cal-event cal-event--dated" data-event="${evtJson}" role="button" tabindex="0">
      <span class="cal-event__day">${escapeHtml(dayText)}</span>
      <span class="cal-event__time${ev.allDay ? ' cal-event__time--allday' : ''}">
        ${ev.allDay ? 'All day' : TIME_FMT.format(new Date(ev.startsAt))}
      </span>
      <span class="cal-event__main">
        <span class="cal-event__title">${escapeHtml(ev.title)}</span>
        ${ev.sub ? `<span class="cal-event__sub">${escapeHtml(ev.sub)}</span>` : ''}
      </span>
      ${chip ? `<span class="cal-chip cal-chip--${slug(ev.calendar)}">${escapeHtml(ev.calendar || '')}</span>` : ''}
    </li>`;
}

// ───── grouping ─────

// Split events at the horizon: `within` [today .. today+days) feeds the
// grouped views; `later` (soonest first) feeds the empty state's Coming-up.
// Already-running multi-day events count as today.
export function splitByHorizon(events, days, now = new Date()) {
  const today = dayStart(now);
  const within = [];
  const later = [];
  for (const ev of events ?? []) {
    if (!ev?.startsAt) continue;
    const idx = dayIndexOf(ev, today);
    (idx < days ? within : later).push(ev);
  }
  later.sort(byStart);
  return { within, later };
}

// Bucket events into local days [today .. today+days). Multi-day all-day
// events land on their start day (or today, if already running). Within a
// day: all-day first, then by start time.
export function groupByDay(events, days, now = new Date()) {
  const today = dayStart(now);
  const groups = new Map(); // dayIndex → events

  for (const ev of events ?? []) {
    if (!ev?.startsAt) continue;
    const idx = dayIndexOf(ev, today);
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

// Bucket within-horizon events by calendar label, household order first
// (PERSON_ORDER), then A→Z for anything unexpected. Within a person:
// chronological — all-day events parse to local midnight, so they naturally
// lead their day.
export function groupByPerson(events, days, now = new Date()) {
  const today = dayStart(now);
  const groups = new Map(); // person → events

  for (const ev of events ?? []) {
    if (!ev?.startsAt) continue;
    if (dayIndexOf(ev, today) >= days) continue;
    const person = ev.calendar || 'Other';
    if (!groups.has(person)) groups.set(person, []);
    groups.get(person).push(ev);
  }

  const rank = (label) => {
    const i = PERSON_ORDER.indexOf(label);
    return i === -1 ? PERSON_ORDER.length : i;
  };

  return [...groups.entries()]
    .sort(([a], [b]) => (rank(a) - rank(b)) || a.localeCompare(b))
    .map(([person, evs]) => ({ person, events: evs.sort(byStart) }));
}

// ───── date helpers ─────

function byStart(a, b) {
  return parseLocalish(a.startsAt) - parseLocalish(b.startsAt);
}

function dayStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Day offset from `today`, clamped so already-running events read as today.
function dayIndexOf(ev, today) {
  const start = dayStart(parseLocalish(ev.startsAt));
  const idx = Math.round((start - today) / 86_400_000);
  return idx < 0 ? 0 : idx;
}

function dayLabel(idx, today) {
  if (idx === 0) return 'Today';
  if (idx === 1) return 'Tomorrow';
  const d = new Date(today);
  d.setDate(d.getDate() + idx);
  return DAY_FMT.format(d);
}

// Compact inline label for person-section rows: Today / Tomorrow / "Sat".
function nearDayLabel(ev, today) {
  const idx = dayIndexOf(ev, today);
  if (idx === 0) return 'Today';
  if (idx === 1) return 'Tomorrow';
  return WEEKDAY_FMT.format(parseLocalish(ev.startsAt));
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

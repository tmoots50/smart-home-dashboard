// Month-view calendar overlay — the Google/iCal-style month grid behind the
// action bar's calendar button. Read-only on purpose (edits belong to the
// phone calendar apps).
//
// Layout: header (title tracks the month in view; ‹ › jump a month; ✕ closes)
// + a calendar legend (tap a calendar to filter the whole view to it, tap
// again to clear) + one vertical scroller stacking month sections. Scrolling
// down reveals the next months (sections append as you approach the end);
// the arrows scroll month-by-month and prepend past months on demand. Chip
// tap → shared event-detail panel; "+N more" or a day tap → day-detail sheet.
// Nav stays clamped to now ± NAV_LIMIT_MONTHS (the API serves ± 366 days).
//
// Anti-flicker contract (2026-07-11 feedback: month nav "reloads twice"):
// sections render once and are PATCHED in place when live data lands — and
// only when it actually differs. There is no full-panel repaint after mount.
// Paired with lib/calendar.js no longer serving mock months when a token is
// configured, a fresh month paints once: quiet empty grid → real events.
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
// Household roster — legend order and colors stay stable before data loads.
// Calendars that appear in event data but not here append after, unfiltered.
const ROSTER = ['Family', 'Tim', 'Caroline'];

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

// Filter + legend + chip colors all key off the PERSON (a person's work and
// personal calendars share one hue and one legend entry; tapping "Tim"
// filters to both). `calendar` fallback covers pre-multi-source events.
function filterEvents(events, filter) {
  if (!filter) return events ?? [];
  return (events ?? []).filter(ev => slug(personOf(ev)) === filter);
}

// Legend roster: the household three, plus any person the data surfaces
// that we didn't expect (renders with the "other" hue).
function legendRoster(events) {
  const known = new Set(ROSTER.map(slug));
  const extras = [];
  for (const ev of events ?? []) {
    const s = slug(personOf(ev));
    if (!known.has(s)) {
      known.add(s);
      extras.push(personOf(ev) || 'Other');
    }
  }
  return [...ROSTER, ...extras];
}

function renderLegend(roster, filter) {
  return roster.map(name => {
    const s = slug(name);
    const state = filter ? (filter === s ? ' is-active' : ' is-dimmed') : '';
    return `
      <button class="month-cal__legend-item month-cal__legend-item--${s}${state}"
              data-filter="${s}" aria-pressed="${filter === s}">
        <i></i>${escapeHtml(name)}
      </button>`;
  }).join('');
}

function renderMonthSection(year, month, events, { now = new Date(), filter = null } = {}) {
  const grid = buildMonthGrid(year, month, filterEvents(events, filter), now);
  return `
    <section class="month-cal__month" data-ym="${year}-${month}">
      <h3 class="month-cal__month-label">${escapeHtml(grid.title)}</h3>
      <div class="month-cal__grid">${grid.cells.map(renderCell).join('')}</div>
    </section>
  `;
}

function panelHtml({ title, legend, sections }) {
  return `
    <div class="overlay__panel month-cal" role="dialog" aria-label="Month calendar">
      <div class="overlay__header">
        <h2 class="overlay__title" data-month-title>${escapeHtml(title)}</h2>
        <div class="month-cal__nav">
          <button class="overlay__close" data-action="prev" aria-label="Previous month">‹</button>
          <button class="overlay__close" data-action="next" aria-label="Next month">›</button>
          <button class="overlay__close" data-action="close" aria-label="Close">${CLOSE_SVG}</button>
        </div>
      </div>
      <div class="month-cal__legend" data-legend>${legend}</div>
      <div class="month-cal__dow">${DOW.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="month-cal__scroller" data-scroller>${sections}</div>
    </div>
  `;
}

// Single-month render — the pure view of one month inside the full panel
// chrome (tests and static previews use this; the interactive overlay builds
// the same pieces incrementally).
export function renderMonthCalendar(events, { year, month, now = new Date(), filter = null } = {}) {
  return panelHtml({
    title: MONTH_FMT.format(new Date(year, month, 1)),
    legend: renderLegend(legendRoster(events), filter),
    sections: renderMonthSection(year, month, events, { now, filter }),
  });
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
  // The 2-line clamp lives on an inner span: clamping the button itself
  // fights its 44px min-height (content that "fits" the tall box skips the
  // clamp, then overflow razor-cuts a third line mid-glyph — the smoosh
  // artifact from the 2026-07-11 wall photo).
  // Work events keep the person hue + gain the is-work marker (dashed edge) —
  // a text pill won't fit a month chip.
  const work = ev.kind === 'work' ? ' is-work' : '';
  return `
    <button class="month-cal__chip month-cal__chip--${slug(personOf(ev))}${work}" data-event="${escapeHtml(JSON.stringify(ev))}">
      <span class="month-cal__chip-text">${time}${escapeHtml(ev.title)}</span>
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
  const byOff = new Map(); // month offset from base → { year, month, events }
  let minOff = 0;
  let maxOff = -1; // no sections yet
  let activeOff = 0;
  let filter = null;
  let scrollRaf = 0;
  let navTarget = null;
  let navTimer = null;

  host.innerHTML = panelHtml({
    title: MONTH_FMT.format(new Date(base.year, base.month, 1)),
    legend: renderLegend(ROSTER, filter),
    sections: '',
  });
  const scroller = host.querySelector('[data-scroller]');
  const titleEl = host.querySelector('[data-month-title]');
  const legendEl = host.querySelector('[data-legend]');

  const dateOf = (off) => new Date(base.year, base.month + off, 1);
  const offOfYm = (ym) => {
    const [y, m] = String(ym).split('-').map(Number);
    return (y - base.year) * 12 + (m - base.month);
  };
  const sectionOf = (off) => {
    const d = dateOf(off);
    return scroller.querySelector(`[data-ym="${d.getFullYear()}-${d.getMonth()}"]`);
  };

  function patch(off) {
    const rec = byOff.get(off);
    const sec = sectionOf(off);
    if (!rec || !sec) return;
    const grid = buildMonthGrid(rec.year, rec.month, filterEvents(rec.events, filter), now);
    sec.querySelector('.month-cal__grid').innerHTML = grid.cells.map(renderCell).join('');
  }

  function refreshLegend() {
    const all = [...byOff.values()].flatMap(rec => rec.events);
    const next = renderLegend(legendRoster(all), filter);
    if (legendEl.innerHTML !== next) legendEl.innerHTML = next;
  }

  function load(off) {
    const rec = byOff.get(off);
    const { initial, live } = source.getMonth(rec.year, rec.month);
    rec.events = initial ?? [];
    patch(off);
    refreshLegend();
    live?.then(next => {
      // Patch in place, and only if the data actually changed — repainting
      // identical content is exactly the flicker this widget got flagged for.
      if (!next || JSON.stringify(next) === JSON.stringify(rec.events)) return;
      rec.events = next;
      patch(off);
      refreshLegend();
    }).catch(() => {});
  }

  // Add a month section at the edge of the loaded range. Prepending keeps the
  // viewport stable by compensating scrollTop for the inserted height.
  function addSection(off) {
    if (Math.abs(off) > NAV_LIMIT_MONTHS || byOff.has(off)) return false;
    const d = dateOf(off);
    const rec = { year: d.getFullYear(), month: d.getMonth(), events: [] };
    byOff.set(off, rec);
    const html = renderMonthSection(rec.year, rec.month, [], { now, filter });
    if (off > maxOff) {
      scroller.insertAdjacentHTML('beforeend', html);
      maxOff = Math.max(maxOff, off);
    } else {
      const before = scroller.scrollHeight;
      scroller.insertAdjacentHTML('afterbegin', html);
      scroller.scrollTop += scroller.scrollHeight - before;
      minOff = Math.min(minOff, off);
    }
    load(off);
    return true;
  }

  function setActive(off) {
    activeOff = off;
    titleEl.textContent = MONTH_FMT.format(dateOf(off));
  }

  function nav(dir) {
    // During smooth scrolling, the scroll observer may still report the month
    // we're leaving. Keep arrow intent separate until the target section is
    // actually observed; otherwise a rapid Next → Previous can become two
    // Previous actions (July → August → June).
    const target = (navTarget ?? activeOff) + dir;
    if (Math.abs(target) > NAV_LIMIT_MONTHS) return;
    if (!byOff.has(target)) addSection(target);
    navTarget = target;
    clearTimeout(navTimer);
    navTimer = setTimeout(() => { navTarget = null; }, 700);
    setActive(target);
    sectionOf(target)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  // Scroll drives two things: appending the next month as the end approaches,
  // and keeping the header title on the month occupying the top of the view.
  function onScroll() {
    if (scroller.scrollTop + scroller.clientHeight * 2 > scroller.scrollHeight) {
      addSection(maxOff + 1);
    }
    const probe = scroller.getBoundingClientRect().top + Math.min(120, scroller.clientHeight / 3);
    for (const sec of scroller.children) {
      const r = sec.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) {
        const off = offOfYm(sec.dataset.ym);
        if (navTarget != null && off !== navTarget) break;
        if (off === navTarget) {
          navTarget = null;
          clearTimeout(navTimer);
        }
        if (off !== activeOff) setActive(off);
        break;
      }
    }
  }
  scroller.addEventListener('scroll', () => {
    if (scrollRaf || typeof requestAnimationFrame !== 'function') return onScroll();
    scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; onScroll(); });
  });

  function toggleFilter(slugName) {
    filter = filter === slugName ? null : slugName;
    for (const off of byOff.keys()) patch(off);
    refreshLegend();
  }

  function close() {
    document.removeEventListener('keydown', onKey);
    document.documentElement.classList.remove('has-overlay');
    if (scrollRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(scrollRaf);
    clearTimeout(navTimer);
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
    const legendItem = e.target.closest('[data-filter]');
    if (legendItem) return toggleFilter(legendItem.dataset.filter);
    const chip = e.target.closest('.month-cal__chip');
    if (chip) {
      try { openEventDetail(JSON.parse(chip.dataset.event)); } catch {}
      return;
    }
    const section = e.target.closest('.month-cal__month');
    const day = e.target.closest('.month-cal__more')?.dataset.date
      ?? e.target.closest('.month-cal__day:not(.is-outside)')?.dataset.date;
    if (day && section) {
      const rec = byOff.get(offOfYm(section.dataset.ym));
      const cell = buildMonthGrid(rec.year, rec.month, filterEvents(rec?.events, filter), now)
        .cells.find(c => c.date === day);
      openDayDetail(day, cell?.events ?? []);
    }
  });

  document.addEventListener('keydown', onKey);
  addSection(0);
  addSection(1); // one month of scroll-ahead so "next" is already there
  setActive(0);
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
              <span class="cal-event__title">${escapeHtml(ev.title)}${ev.kind === 'work' ? ' <span class="cal-tag cal-tag--work">Work</span>' : ''}</span>
              ${ev.sub ? `<span class="cal-event__sub">${escapeHtml(ev.sub)}</span>` : ''}
            </span>
            <span class="cal-chip cal-chip--${slug(personOf(ev))}">${escapeHtml(personOf(ev) || '')}</span>
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

// Person the event belongs to; raw calendar label for pre-multi-source events.
function personOf(ev) {
  return ev?.person || ev?.calendar || '';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

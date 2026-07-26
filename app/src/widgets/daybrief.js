// Morning Brief card — the one editorial card on the wall. Hermes composes it
// daily (~7:30a) as judgment, not data: a headline, only the sections that
// earn their place that day, and a dry one-line closer. Everything else on
// the dashboard is a feed; this is the note a good EA leaves on the counter.
//
// Four render flavors behind one entry point (mirrors calendar.js):
//   columns — headline + sections flowing into two balanced columns (default)
//   split   — semantic halves: your day (today/attention/todos/mabel) on the
//             left, after-work & ahead (errands/kitchen/comingup/…) right
//   letter  — written prose (payload `body` paragraphs) on the left, compact
//             structured bullets on the right; falls back to columns when the
//             payload has no body
//   agenda  — timeline-first: today's items with big time tokens down a
//             gutter, everything else in a compact right rail
// The payload always carries BOTH body and sections; flavor is pure
// presentation, so switching flavors never needs a new Hermes post.
//
// Lifecycle: the card renders only when the blob's `date` is today, it hasn't
// been cleared, and it's before noon (a morning brief still up at 4pm is
// clutter — Tim, 2026-07-25). It sits above the family calendar and pushes it
// down; clearing it (✓, with Undo toast) reflows the calendar back up.
// Cleared state is kiosk-local, keyed by the brief's date so yesterday's
// clear never hides today's brief.
//
// Sections carry a `kind` (today / attention / errands / comingup / kitchen /
// todos / mabel) used for grouping + theme accents; unknown kinds render
// generically off their `title`, so Hermes can invent a section without a
// frontend deploy.

import { parseLocalDate } from '../lib/comingup.js';
import { fetchDaybrief, isConfigured } from '../lib/daybrief.js';
import { showToast } from './toast.js';

const REFRESH_MS = 5 * 60 * 1000;
const DISMISSED_KEY = 'daybrief:dismissed:v1';
const NOON_HOUR = 12;
const DEFAULT_FLAVOR = 'columns';

// split flavor: the day itself vs. after work & the days ahead. Unknown
// kinds land on the right — they're almost always "ahead"-shaped.
const SPLIT_LEFT = new Set(['today', 'attention', 'todos', 'mabel']);

export function renderDaybrief(data, { flavor = DEFAULT_FLAVOR } = {}) {
  const sections = (data.sections ?? []).filter(s => s?.items?.length);
  const body = (data.body ?? []).filter(Boolean);
  if (flavor === 'letter' && !body.length) flavor = 'columns';

  let middle = '';
  if (flavor === 'split') middle = renderSplit(sections);
  else if (flavor === 'letter') middle = renderLetter(body, sections, data.bodyTitle);
  else if (flavor === 'agenda') middle = renderAgenda(sections);
  else middle = sections.length ? `<div class="daybrief__cols">${sections.map(s => renderSection(s)).join('')}</div>` : '';

  return `
    <div class="card__header daybrief__header">
      <h2 class="card__title">Morning Brief · ${escapeHtml(formatDate(data.date))}</h2>
      <button class="daybrief__clear" data-action="clear" aria-label="Clear morning brief"></button>
    </div>
    ${data.headline ? `<p class="daybrief__headline">${escapeHtml(data.headline)}</p>` : ''}
    ${middle}
    ${data.closer ? `<p class="daybrief__closer">${md(data.closer)}</p>` : ''}
  `;
}

function renderSplit(sections) {
  if (!sections.length) return '';
  const left = sections.filter(s => SPLIT_LEFT.has(s.kind));
  const right = sections.filter(s => !SPLIT_LEFT.has(s.kind));
  // Everything landed on one side → a divider around nothing looks broken.
  if (!left.length || !right.length) {
    return `<div class="daybrief__cols">${sections.map(s => renderSection(s)).join('')}</div>`;
  }
  return `
    <div class="daybrief__split">
      <div class="daybrief__pane">${left.map(s => renderSection(s)).join('')}</div>
      <div class="daybrief__pane">${right.map(s => renderSection(s)).join('')}</div>
    </div>`;
}

function renderLetter(body, sections, bodyTitle = 'Headlines') {
  return `
    <div class="daybrief__letter">
      <section class="daybrief__section daybrief__section--headlines">
        <h3 class="daybrief__section-label">${escapeHtml(bodyTitle)}</h3>
        <div class="daybrief__body">
          ${body.map(p => `<p>${md(p)}</p>`).join('')}
        </div>
      </section>
      ${sections.length
        ? `<div class="daybrief__rail">${sections.map(s => renderSection(s, { compact: true })).join('')}</div>`
        : ''}
    </div>`;
}

function renderAgenda(sections) {
  if (!sections.length) return '';
  const today = sections.find(s => s.kind === 'today');
  const rest = sections.filter(s => s !== today);
  if (!today) return `<div class="daybrief__cols">${sections.map(s => renderSection(s)).join('')}</div>`;
  return `
    <div class="daybrief__agenda">
      <section class="daybrief__section daybrief__section--today">
        <h3 class="daybrief__section-label">${escapeHtml(today.title ?? 'Today')}</h3>
        <ul class="daybrief__timeline">
          ${today.items.map(it => `
            <li class="daybrief__tl-item">
              <span class="daybrief__tl-time">${escapeHtml(it.time ?? '·')}</span>
              <span class="daybrief__text">${md(it.text)}</span>
            </li>`).join('')}
        </ul>
      </section>
      ${rest.length
        ? `<div class="daybrief__rail">${rest.map(s => renderSection(s, { compact: true })).join('')}</div>`
        : ''}
    </div>`;
}

function renderSection(s, { compact = false } = {}) {
  const kind = /^[a-z-]+$/.test(s.kind ?? '') ? s.kind : 'note';
  return `
    <section class="daybrief__section daybrief__section--${kind}${compact ? ' daybrief__section--compact' : ''}">
      <h3 class="daybrief__section-label">${escapeHtml(s.title ?? '')}</h3>
      <ul class="daybrief__list">
        ${s.items.map(it => `
          <li class="daybrief__item">
            ${it.time
              ? `<span class="daybrief__time">${escapeHtml(it.time)}</span>`
              : '<span class="daybrief__dot">·</span>'}
            <span class="daybrief__text">${md(it.text)}</span>
          </li>`).join('')}
      </ul>
    </section>`;
}

// The only markdown the brief supports: **bold**. Escape first, then swap the
// markers, so Hermes can emphasize but never inject markup.
function md(s) {
  return escapeHtml(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

// Visible = a real brief, for today, before noon, not cleared.
export function isVisible(data, now, dismissedDate = readDismissed()) {
  if (!data?.date) return false;
  const hasContent = data.headline || (data.body ?? []).length || (data.sections ?? []).some(s => s?.items?.length);
  if (!hasContent) return false;
  if (data.date !== localYMD(now)) return false;
  if (now.getHours() >= NOON_HOUR) return false;
  // Clearing hides THIS generation, not the whole day: a re-published brief
  // (new generatedAt) supersedes an earlier collapse and reappears
  // (Tim, 2026-07-26 — "i had collapsed the original; push this new one").
  return dismissedDate !== dismissKey(data);
}

// Pre-generatedAt blobs fall back to the date, matching the old behavior.
function dismissKey(data) {
  return data.generatedAt ?? data.date;
}

export function mountDaybrief(el, source, { now = () => new Date(), flavor } = {}) {
  let data = source.initial ?? null;

  const draw = () => {
    if (isVisible(data, now())) {
      el.hidden = false;
      el.innerHTML = renderDaybrief(data, { flavor });
    } else {
      el.hidden = true;
      el.innerHTML = '';
    }
  };

  el.addEventListener('click', (e) => {
    if (!e.target.closest('[data-action="clear"]') || !data?.date) return;
    const key = dismissKey(data);
    writeDismissed(key);
    draw();
    showToast('Morning brief cleared', {
      actionLabel: 'Undo',
      onAction: () => {
        if (readDismissed() === key) writeDismissed(null);
        draw();
      },
    });
  });

  draw();
  source.live.then(next => { if (next !== undefined) { data = next; draw(); } });
  const id = setInterval(() => {
    // Redraw regardless so the noon cutoff lands within 5 min of 12:00.
    if (isConfigured) fetchDaybrief().then(next => { data = next; draw(); }).catch(() => draw());
    else draw();
  }, REFRESH_MS);
  return () => clearInterval(id);
}

function readDismissed() {
  try { return localStorage.getItem(DISMISSED_KEY); } catch { return null; }
}
function writeDismissed(date) {
  try {
    if (date) localStorage.setItem(DISMISSED_KEY, date);
    else localStorage.removeItem(DISMISSED_KEY);
  } catch {}
}

function localYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDate(dateStr) {
  const d = parseLocalDate(dateStr);
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d);
  const month = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(d);
  return `${weekday}, ${month} ${d.getDate()}`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

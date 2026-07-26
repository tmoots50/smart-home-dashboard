// Morning Brief card — the one editorial card on the wall. Hermes composes it
// daily (~7:30a) as judgment, not data: a headline, only the sections that
// earn their place that day, and a dry one-line closer. Everything else on
// the dashboard is a feed; this is the note a good EA leaves on the counter.
//
// Lifecycle: the card renders only when the blob's `date` is today, it hasn't
// been cleared, and it's before noon (a morning brief still up at 4pm is
// clutter — Tim, 2026-07-25). It sits above the family calendar and pushes it
// down; clearing it (✓, with Undo toast) reflows the calendar back up.
// Cleared state is kiosk-local, keyed by the brief's date so yesterday's
// clear never hides today's brief.
//
// Sections carry a `kind` (today / errands / comingup / kitchen / todos /
// mabel) used for theme accents; unknown kinds render generically off their
// `title`, so Hermes can invent a section without a frontend deploy.

import { parseLocalDate } from '../lib/comingup.js';
import { fetchDaybrief, isConfigured } from '../lib/daybrief.js';
import { showToast } from './toast.js';

const REFRESH_MS = 5 * 60 * 1000;
const DISMISSED_KEY = 'daybrief:dismissed:v1';
const NOON_HOUR = 12;

export function renderDaybrief(data) {
  const sections = (data.sections ?? []).filter(s => s?.items?.length);
  return `
    <div class="card__header daybrief__header">
      <h2 class="card__title">Morning Brief · ${escapeHtml(formatDate(data.date))}</h2>
      <button class="daybrief__clear" data-action="clear" aria-label="Clear morning brief"></button>
    </div>
    ${data.headline ? `<p class="daybrief__headline">${escapeHtml(data.headline)}</p>` : ''}
    ${sections.length ? `<div class="daybrief__cols">${sections.map(renderSection).join('')}</div>` : ''}
    ${data.closer ? `<p class="daybrief__closer">${escapeHtml(data.closer)}</p>` : ''}
  `;
}

function renderSection(s) {
  const kind = /^[a-z-]+$/.test(s.kind ?? '') ? s.kind : 'note';
  return `
    <section class="daybrief__section daybrief__section--${kind}">
      <h3 class="daybrief__section-label">${escapeHtml(s.title ?? '')}</h3>
      <ul class="daybrief__list">
        ${s.items.map(it => `
          <li class="daybrief__item">
            ${it.time
              ? `<span class="daybrief__time">${escapeHtml(it.time)}</span>`
              : '<span class="daybrief__dot">·</span>'}
            <span class="daybrief__text">${escapeHtml(it.text)}</span>
          </li>`).join('')}
      </ul>
    </section>`;
}

// Visible = a real brief, for today, before noon, not cleared.
export function isVisible(data, now, dismissedDate = readDismissed()) {
  if (!data?.date) return false;
  if (!data.headline && !(data.sections ?? []).some(s => s?.items?.length)) return false;
  if (data.date !== localYMD(now)) return false;
  if (now.getHours() >= NOON_HOUR) return false;
  return dismissedDate !== data.date;
}

export function mountDaybrief(el, source, { now = () => new Date() } = {}) {
  let data = source.initial ?? null;

  const draw = () => {
    if (isVisible(data, now())) {
      el.hidden = false;
      el.innerHTML = renderDaybrief(data);
    } else {
      el.hidden = true;
      el.innerHTML = '';
    }
  };

  el.addEventListener('click', (e) => {
    if (!e.target.closest('[data-action="clear"]') || !data?.date) return;
    const date = data.date;
    writeDismissed(date);
    draw();
    showToast('Morning brief cleared', {
      actionLabel: 'Undo',
      onAction: () => {
        if (readDismissed() === date) writeDismissed(null);
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

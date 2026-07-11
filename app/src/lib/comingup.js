// Coming-Up rules engine — categorize, window, dedupe, and rank the 90-day
// event feed into the widget's two panes:
//
//   left  — "Next 4 weeks": everything from the END of the current week
//           (Sunday 00:00) through +28 days, chronological. This week is
//           excluded on purpose — it's already on the Family Calendar card.
//   right — "Plan ahead": the next 90 days of things that likely need
//           planning (travel, flights, offsites, anything vague or
//           big-effort), no dupes with the left pane, ordered by IMPORTANCE.
//
// Category → color coding (see global.css .countdown__item--*):
//   birthday | mabel | travel | recurring
//
// This module is the "Hermes seam": rankComingUp() is the single pure
// function that decides membership and order. Hermes adjusts it ad-hoc via
// /api/comingup overrides ({match, score?, pane?, hide?}) — Tim tells Hermes
// "move the flight up / hide the watering", Hermes POSTs, the widget merges
// on its next refresh. Baseline order stays deterministic.

const DAY_MS = 86_400_000;

const LEFT_WINDOW_DAYS = 28;
const RIGHT_WINDOW_DAYS = 90;

// Signal patterns run against "title sub". Deliberately loose — a false
// positive colors a row, it doesn't hide anything.
const RX = {
  birthday: /\bbirthday\b|\bbday\b|\bb-day\b/i,
  mabel: /\bmabel\b|\bpediatric/i,
  travel: /\bflight\b|\bfly\b|\bairport\b|\btrip\b|\btravel\b|\bvacation\b|\bairbnb\b|\bhotel\b|\bstay at\b|\bcabin\b|\bbeach house\b|\blake house\b/i,
  offsite: /\boffsite\b|\bretreat\b/i,
  bigEffort: /\bparty\b|\bshower\b|\bwedding\b|\breunion\b|\bmarathon\b|\bhalf marathon\b|\brace\b|\bmoving\b|\bmove out\b|\bmove in\b/i,
  vague: /\btbd\b|\bhold\b|\bsave the date\b|\bplan\b|\bfigure out\b|\bsomeday\b|\?\?/i,
  // Fallback recurring detection for feeds without the API's `recurring`
  // flag (mock data, stale caches).
  recurringish: /\bpill\b|\bmeds?\b|\bmedication\b|\bheartworm\b|\bgrooming\b|\bwater(ing)?\b|\brefill\b|\bweekly\b|\bmonthly\b/i,
};

// Importance ladder for the plan-ahead ordering. Bigger = higher in the pane.
const SCORE = {
  travel: 100,
  offsite: 90,
  mabel: 80,
  birthday: 70,
  bigEffort: 60,
  vague: 55,
  other: 45,
  recurring: 30,
};

export function rankComingUp(events, { now = new Date(), overrides = [] } = {}) {
  const today = dayStart(now);
  const wkEnd = weekEnd(now);
  const leftEnd = addDays(wkEnd, LEFT_WINDOW_DAYS);
  const rightEnd = addDays(today, RIGHT_WINDOW_DAYS);

  const enriched = (events ?? [])
    .map(normalizeItem)
    .filter(it => it.startsAt)
    .map(it => classify(it))
    .map(it => applyOverride(it, overrides))
    .filter(it => !it.hidden)
    .map(it => ({ ...it, day: dayStart(parseLocalDate(it.startsAt)) }))
    .filter(it => it.day >= today)
    .map(it => ({ ...it, days: Math.round((it.day - today) / DAY_MS) }))
    .sort((a, b) => (a.day - b.day) || String(a.startsAt).localeCompare(String(b.startsAt)));

  // Left: chronological agenda. Repeating series show once (their first
  // occurrence) — five "Water planters" rows is noise, not information.
  // Hermes-scored items float to the top (score desc), the rest stay
  // chronological; a forced pane wins over the window rules.
  const left = dedupeByTitle(enriched.filter(it =>
    it.pane === 'left' ||
    (it.pane !== 'right' && it.day >= wkEnd && it.day < leftEnd),
  )).sort((a, b) => (byScored(a, b)) || (a.day - b.day));

  const leftKeys = new Set(left.map(it => it.key));
  const right = dedupeByTitle(
    enriched.filter(it =>
      !leftKeys.has(it.key) &&
      (it.pane === 'right' || (it.pane !== 'left' && it.day < rightEnd && it.needsPlanning))),
  ).sort((a, b) => (b.score - a.score) || (a.day - b.day));

  return { left, right };
}

// Merge the first matching /api/comingup override into one classified item.
// match = case-insensitive title substring, or the exact id/key.
function applyOverride(it, overrides) {
  for (const o of overrides ?? []) {
    const m = String(o?.match ?? '');
    if (!m) continue;
    const hit = it.key === m || String(it.id ?? '') === m ||
      it.name.toLowerCase().includes(m.toLowerCase());
    if (!hit) continue;
    const out = { ...it };
    if (o.hide) out.hidden = true;
    if (typeof o.score === 'number') { out.score = o.score; out.scored = true; }
    if (o.pane === 'left' || o.pane === 'right') out.pane = o.pane;
    return out;
  }
  return it;
}

function byScored(a, b) {
  if (a.scored && b.scored) return b.score - a.score;
  return (b.scored ? 1 : 0) - (a.scored ? 1 : 0);
}

// Tag one event with category, planning-need, and importance score.
export function classify(it) {
  const text = `${it.name} ${it.sub ?? ''}`;
  const isMultiDayAllDay = Boolean(
    it.allDay && it.endsAt &&
    (parseLocalDate(it.endsAt) - parseLocalDate(it.startsAt)) > DAY_MS,
  );
  const travelish = RX.travel.test(text) || isMultiDayAllDay;
  const recurring = Boolean(it.recurring) || RX.recurringish.test(text);

  let category = null;
  if (RX.birthday.test(text)) category = 'birthday';
  else if (RX.mabel.test(text)) category = 'mabel';
  else if (travelish) category = 'travel';
  else if (recurring) category = 'recurring';

  const needsPlanning =
    travelish || RX.offsite.test(text) || RX.bigEffort.test(text) || RX.vague.test(text);

  let score = SCORE.other;
  if (travelish) score = SCORE.travel;
  else if (RX.offsite.test(text)) score = SCORE.offsite;
  else if (category === 'mabel') score = SCORE.mabel;
  else if (category === 'birthday') score = SCORE.birthday;
  else if (RX.bigEffort.test(text)) score = SCORE.bigEffort;
  else if (RX.vague.test(text)) score = SCORE.vague;
  else if (recurring) score = SCORE.recurring;

  return { ...it, category, needsPlanning, score };
}

// Accepts both calendar events ({title, startsAt}) and legacy countdown
// items ({name, date}); one key shape for dismissal storage.
export function normalizeItem(it) {
  const startsAt = it.startsAt || it.date;
  const name = it.title || it.name || '';
  return { ...it, startsAt, name, key: String(it.id || `${name}|${startsAt}`) };
}

function dedupeByTitle(items) {
  const seen = new Set();
  return items.filter(it => {
    const t = it.name.trim().toLowerCase();
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

// ── date helpers ──

// Sunday 00:00 after the current week (weeks run Sun–Sat, matching the
// month grid's day-of-week header).
export function weekEnd(now) {
  const d = dayStart(now);
  d.setDate(d.getDate() + (7 - d.getDay()));
  return d;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dayStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function parseLocalDate(s) {
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(s);
}

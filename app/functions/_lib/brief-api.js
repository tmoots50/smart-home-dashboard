// Pure validation/normalization for the Morning Brief blob — no I/O,
// unit-testable. Written daily (~7:30a) by the Hermes morning-briefing job,
// read by the daybrief widget.
//
// The blob is judgment, not data: a short headline, "Headlines" prose
// paragraphs (beat-reporter ledes, **bold** markdown only), structured
// sections, and a dry closer. The full composition contract — voice, section
// order/caps, Coming Up cadence, day-of-week readahead — lives in
// docs/morning-brief.md; this module only enforces shape and size so a bad
// post can't break the wall.
//
// Design choice mirrors curated-api.js: malformed items/sections are dropped,
// not fatal — one bad row shouldn't sink the day's brief. The exceptions are
// a missing/malformed `date` (the widget keys visibility off it) and a
// payload with no content at all: both hard-reject so the caller notices.

export const BODY_MAX = 6;        // paragraphs
export const SECTIONS_MAX = 8;
export const ITEMS_MAX = 8;       // per section

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function str(v, max) {
  return typeof v === 'string' ? v.slice(0, max).trim() : '';
}

function normItem(it) {
  if (!it || typeof it !== 'object') return null;
  const text = str(it.text, 300);
  if (!text) return null; // text is required
  const time = str(it.time, 20);
  return time ? { time, text } : { text };
}

function normSection(s) {
  if (!s || typeof s !== 'object') return null;
  const items = (Array.isArray(s.items) ? s.items : [])
    .map(normItem).filter(Boolean).slice(0, ITEMS_MAX);
  if (!items.length) return null; // empty sections never render — drop them
  return {
    kind: str(s.kind, 40) || 'note',
    title: str(s.title, 60),
    items,
  };
}

// Returns { ok:true, value } or { ok:false, error }. `nowIso` is injected so
// the function stays pure (the handler passes new Date().toISOString()).
export function normalizeBrief(payload, nowIso) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const date = str(payload.date, 10);
  if (!YMD.test(date)) {
    return { ok: false, error: 'date must be YYYY-MM-DD (the local day the brief is for)' };
  }

  const headline = str(payload.headline, 160);
  const body = (Array.isArray(payload.body) ? payload.body : [])
    .map(p => str(p, 600)).filter(Boolean).slice(0, BODY_MAX);
  const sections = (Array.isArray(payload.sections) ? payload.sections : [])
    .map(normSection).filter(Boolean).slice(0, SECTIONS_MAX);
  const closer = str(payload.closer, 240);
  const bodyTitle = str(payload.bodyTitle, 40);

  if (!headline && !body.length && !sections.length) {
    return { ok: false, error: 'brief has no content (need headline, body, or sections)' };
  }

  return {
    ok: true,
    value: {
      generatedAt: nowIso,
      date,
      headline,
      ...(bodyTitle ? { bodyTitle } : {}),
      body,
      sections,
      closer: closer || null,
    },
  };
}

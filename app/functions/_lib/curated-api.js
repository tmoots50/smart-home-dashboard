// Pure validation/normalization for the curated blob — no I/O, unit-testable.
//
// The blob is a tiny mutable "latest curated content" doc: what the dashboard
// should show right now, written by the daily Hermes curation job. Two sections,
// both optional, both clamped:
//   picks    — up to PICKS_MAX taste-picked items (the daily Atlanta pick; the
//              widget shows picks[0], so a one-item array is the normal case).
//   comingUp — up to COMING_MAX important upcoming events (Feature B; stored and
//              passed through even though its widget isn't wired yet).
//
// Design choice: individual malformed items are dropped, not fatal — one bad row
// shouldn't sink a whole curation run. The ONE exception is a present-but-non-
// http(s) pick url: that's rejected outright (see below), because silently
// stripping a link would hide either a bug or an injection attempt.

export const PICKS_MAX = 3;
export const COMING_MAX = 3;

export function isHttpUrl(u) {
  if (typeof u !== 'string') return false;
  try {
    const { protocol } = new URL(u);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function str(v, max) {
  return typeof v === 'string' ? v.slice(0, max).trim() : '';
}

function normPick(p) {
  if (!p || typeof p !== 'object') return null;
  const title = str(p.title, 300);
  if (!title) return null; // title is required
  return {
    source: str(p.source, 60),
    title,
    url: isHttpUrl(p.url) ? p.url : '', // absent/bad url → non-clickable, not fatal
    note: str(p.note, 300),
  };
}

function normComingUp(c) {
  if (!c || typeof c !== 'object') return null;
  const name = str(c.name, 200);
  const date = str(c.date, 40);
  if (!name || !date) return null; // both required
  return {
    name,
    date,
    sub: str(c.sub, 120),
    note: str(c.note, 300),
    kind: str(c.kind, 40),
  };
}

// Returns { ok:true, value } or { ok:false, error }. `nowIso` is injected so the
// function stays pure (the handler passes new Date().toISOString()).
export function normalizeCurated(payload, nowIso) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const picksIn = Array.isArray(payload.picks) ? payload.picks : [];
  const comingIn = Array.isArray(payload.comingUp) ? payload.comingUp : [];

  // Stored-XSS guard: the pick url comes from Hermes's untrusted web research.
  // A url that was PRESENT but isn't http(s) is a hard reject — not a silent
  // drop — so the caller notices rather than publishing a link-less pick.
  for (const p of picksIn) {
    if (p && p.url != null && p.url !== '' && !isHttpUrl(p.url)) {
      return { ok: false, error: `pick url must be http(s): ${String(p.url).slice(0, 80)}` };
    }
  }

  const picks = picksIn.map(normPick).filter(Boolean).slice(0, PICKS_MAX);
  const comingUp = comingIn.map(normComingUp).filter(Boolean).slice(0, COMING_MAX);

  return { ok: true, value: { generatedAt: nowIso, comingUp, picks } };
}

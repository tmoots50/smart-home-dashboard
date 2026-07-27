// Client for /api/checkin — the action-bar clipboard button. Asks Nigel (via
// the Old Mac relay, same path as voice) for a time-of-day check-in brief,
// then watches /api/brief until the published blob lands.
//
// The dashboard never generates content itself: this lib only *requests* and
// *waits*. Nigel composes on the Old Mac and POSTs to /api/brief like the
// morning job; arrival is detected by a kind:"checkin" blob whose generatedAt
// differs from the one we saw before asking (identity comparison, so client
// clock drift can't produce false negatives).

import { fetchDaybrief } from './daybrief.js';

const TOKEN = import.meta.env.VITE_DASHBOARD_TOKEN;
export const isConfigured = Boolean(TOKEN);

// Composition on the Old Mac takes a minute or two; poll gently, cap at 4 min.
const POLL_MS = 12_000;
const TIMEOUT_MS = 4 * 60_000;

// Throws Error with .status (429 relay busy, 501 unconfigured, 502/504
// unreachable/asleep) so the view can pick an honest toast.
export async function requestCheckin() {
  const res = await fetch('/api/checkin', {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `checkin: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data; // { status: 'requested', reply }
}

// Resolves with the new check-in blob, or null on timeout. `sleep` is
// injectable for tests.
export async function awaitCheckinBrief({
  afterGeneratedAt = null,
  timeoutMs = TIMEOUT_MS,
  intervalMs = POLL_MS,
  sleep = (ms) => new Promise(r => setTimeout(r, ms)),
} = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(intervalMs);
    try {
      const blob = await fetchDaybrief();
      if (blob?.kind === 'checkin' && blob.generatedAt && blob.generatedAt !== afterGeneratedAt) {
        return blob;
      }
    } catch {
      // Transient fetch failure — keep polling until the deadline.
    }
  }
  return null;
}

// Daily message client. Reads /messages.json (served by CF Pages from app/public/),
// picks the entry whose `date` matches today's local date. If no entry matches,
// falls back to the most recent past entry. If the file can't be loaded at all,
// falls back to the mock so the widget never goes blank.
//
// Publishing model: edit app/public/messages.json, commit, push — CF Pages
// auto-deploys. No backend required.

import { getMockAiMessage } from './aimessage-mock.js';

function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function pickMessage(entries, today) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const exact = entries.find(e => e.date === today);
  if (exact) return exact;
  // No exact match — pick the most recent past entry. Sort by date desc, find first <= today.
  const past = entries
    .filter(e => typeof e.date === 'string' && e.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));
  return past[0] ?? null;
}

function toMessage(entry) {
  if (!entry) return getMockAiMessage();
  // Use the entry's date at noon local as the "sentAt" for the time-ago badge.
  // Most-recent entry on the day-of reads as "today" / "Xh ago"; older entries read
  // as "Xd ago" which is honest about staleness.
  const [y, m, d] = entry.date.split('-').map(Number);
  const sentAt = new Date(y, m - 1, d, 12, 0, 0).toISOString();
  return {
    text: entry.text,
    source: entry.source || 'Note',
    sentAt,
  };
}

export async function fetchAiMessage() {
  const res = await fetch('/messages.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`messages: ${res.status}`);
  const json = await res.json();
  return toMessage(pickMessage(json.messages, todayLocalISO()));
}

export function getAiMessage() {
  // No localStorage cache here — messages.json is small (<2KB), CDN-cached, and
  // we WANT a fresh fetch so newly-published messages show up on next reload.
  const initial = getMockAiMessage();
  const live = fetchAiMessage().catch(() => initial);
  return { initial, live };
}

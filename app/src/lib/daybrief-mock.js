// Mock Morning Brief — what Hermes would post on a reasonably full weekday.
// Dev-only: lib/daybrief.js serves this ONLY when no dashboard token is set.
// In production a missing/stale brief hides the card entirely — an invented
// briefing on the wall is worse than none (contrast lib/curated.js picks,
// where a mock fallback is harmless flavor).

function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getMockDaybrief() {
  return {
    date: todayYMD(),
    generatedAt: new Date().toISOString(),
    headline: 'Full morning, open afternoon. The passport appointment Thursday is the one that needs prep.',
    sections: [
      {
        kind: 'today',
        title: 'Today',
        items: [
          { time: '9:00', text: 'Daycare drop-off — you’re on it' },
          { time: '11:30', text: 'Vet — Chloe, annual shots' },
          { text: 'Work stacks 10–2, then clear — errands fit after 3' },
          { time: '6:30', text: 'Dinner with the Fregos — you’re bringing the wine' },
        ],
      },
      {
        kind: 'errands',
        title: 'On your way home',
        items: [
          { text: 'CVS — Mabel’s prescription is ready (closes 9)' },
          { text: 'Milk + coffee — out of both as of this morning' },
        ],
      },
      {
        kind: 'comingup',
        title: 'Coming up',
        items: [
          { time: 'Thu', text: 'Passport appointment — bring Mabel’s birth certificate (fire safe)' },
          { time: 'Sat', text: 'Aidan’s birthday party — gift still unsorted' },
        ],
      },
      {
        kind: 'kitchen',
        title: 'Kitchen',
        items: [
          { text: 'Salmon tonight — missing lemons; add to the CVS stop' },
          { text: 'Grocery list is at 9 items — a run this week beats two next week' },
        ],
      },
      {
        kind: 'todos',
        title: 'Worth doing today',
        items: [
          { text: 'Renew car registration — expires in 6 days' },
          { text: 'RSVP to the daycare potluck — due tomorrow' },
        ],
      },
    ],
    closer: 'Rain starting around 5 — the stroller cover is still in the trunk from last time. For once, past you delivered.',
  };
}

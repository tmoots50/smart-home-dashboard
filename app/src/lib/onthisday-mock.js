// Mock "On this day" historical fact. Real source: Wikipedia's
// "On this day" feed (https://en.wikipedia.org/wiki/Wikipedia:Selected_anniversaries).
// Returns the fact for the given month/day; falls back to today's date.
//
// Keeps it light — no doom, no death dates. Inventions, openings, milestones.

const FACTS_BY_MMDD = {
  '04-29': { year: 1429, fact: 'Joan of Arc lifted the Siege of Orléans.' },
  '04-30': { year: 1812, fact: 'Louisiana became the 18th U.S. state.' },
  '05-01': { year: 1931, fact: 'The Empire State Building opened in New York City.' },
  '05-02': { year: 1933, fact: 'The first sighting of the Loch Ness Monster was reported.' },
  '05-03': { year: 1952, fact: 'The first commercial jet airliner flight took off — London to Johannesburg.' },
};

export function getMockOnThisDay(now = new Date()) {
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return FACTS_BY_MMDD[`${mm}-${dd}`] ?? FACTS_BY_MMDD['05-01'];
}

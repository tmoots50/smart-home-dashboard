// Mock Huckleberry data for Mabel. Synthetic — public repo shouldn't carry
// private newborn data. Real source: Huckleberry MCP via a Pi-side bridge.
//
// Event types: 'nurse' | 'bottle' | 'pee' | 'poop'.

const BIRTH_DATE = '2026-04-01T00:00:00';

export function getMockMabel(now = new Date()) {
  const minutesAgo = (m) => new Date(now.getTime() - m * 60_000).toISOString();

  // 24-hour synthetic timeline, realistic density for a 4-week-old.
  const events = [
    { type: 'nurse',  at: minutesAgo(1380) },
    { type: 'pee',    at: minutesAgo(1320) },
    { type: 'nurse',  at: minutesAgo(1260) },
    { type: 'pee',    at: minutesAgo(1200) },
    { type: 'poop',   at: minutesAgo(1180) },
    { type: 'bottle', at: minutesAgo(1080) },
    { type: 'pee',    at: minutesAgo(1020) },
    { type: 'nurse',  at: minutesAgo(900) },
    { type: 'pee',    at: minutesAgo(840) },
    { type: 'nurse',  at: minutesAgo(720) },
    { type: 'pee',    at: minutesAgo(680) },
    { type: 'poop',   at: minutesAgo(660) },
    { type: 'bottle', at: minutesAgo(540) },
    { type: 'pee',    at: minutesAgo(500) },
    { type: 'nurse',  at: minutesAgo(420) },
    { type: 'pee',    at: minutesAgo(380) },
    { type: 'nurse',  at: minutesAgo(300) },
    { type: 'pee',    at: minutesAgo(260) },
    { type: 'poop',   at: minutesAgo(240) },
    { type: 'bottle', at: minutesAgo(150) },
    { type: 'nurse',  at: minutesAgo(75) },   // most recent feed
    { type: 'pee',    at: minutesAgo(45) },
    { type: 'pee',    at: minutesAgo(15) },
  ];

  return {
    childName: 'Mabel',
    birthDate: BIRTH_DATE,
    events,
  };
}

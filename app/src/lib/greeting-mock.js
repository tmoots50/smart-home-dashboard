// Mock greeting. Headline rotates by time-of-day; subline rotates by weekday.
// Real source could swap in AI-generated copy via the Claude API later.

const HEADLINES = {
  morning: 'Good morning, Tim and Caroline.',
  afternoon: 'Good afternoon, Tim and Caroline.',
  evening: 'Good evening, Tim and Caroline.',
  night: 'Hello, Tim and Caroline.',
};

const SUBLINES = [
  'Rest well — Sunday.',          // Sun
  'A clean slate.',               // Mon
  'Slow and steady.',             // Tue
  'Halfway through.',             // Wed
  'Almost there.',                // Thu
  'One more push.',               // Fri
  'Take your time — Saturday.',   // Sat
];

function timeOfDay(now) {
  const h = now.getHours();
  if (h < 5) return 'night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

export function getMockGreeting(now = new Date()) {
  return {
    headline: HEADLINES[timeOfDay(now)],
    subline: SUBLINES[now.getDay()],
  };
}

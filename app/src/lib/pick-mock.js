// Mock for the daily Atlanta pick — shown in dev / local-mock mode and as the
// last-resort fallback before Hermes has ever posted a real pick. Shape matches
// a curated pick: { source, title, url, note }.

export function getMockPick() {
  return {
    source: 'On the Cheap',
    title: 'Screen on the Green: “Hoppers” at Cobb County — Fri Jul 29',
    url: 'https://atlantaonthecheap.com/',
    note: 'Free, family-friendly, blanket-on-the-grass evening — easy with Mabel.',
  };
}

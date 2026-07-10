// Mock for the daily Atlanta pick — shown in dev / local-mock mode and as the
// last-resort fallback before Hermes has ever posted a real pick. Shape matches
// a curated pick: { source, title, url, note }.

export function getMockPicks() {
  return [
    {
      source: 'On the Cheap',
      title: 'Screen on the Green at Cobb County',
      url: 'https://atlantaonthecheap.com/',
      note: 'Free, family-friendly, blanket-on-the-grass evening.',
    },
    {
      source: 'Atlanta Parent',
      title: 'Butterfly Festival at Dunwoody Nature Center',
      url: 'https://www.atlantaparent.com/',
      note: 'A low-key outdoor morning with crafts and live butterflies.',
    },
    {
      source: 'Discover Atlanta',
      title: 'Tiny Doors ATL walk on the BeltLine',
      url: 'https://discoveratlanta.com/',
      note: 'Easy stroller outing with coffee stops along the way.',
    },
  ];
}

export function getMockPick() { return getMockPicks()[0]; }

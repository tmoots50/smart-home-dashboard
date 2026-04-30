// Mock upcoming family events. Real source: family calendar filtered by tag.
// Widget shows max 3 nearest upcoming events.

export function getMockCountdowns() {
  return [
    { name: 'Spring Break — Hilton Head', date: '2026-05-15', sub: '' },
    { name: 'Caroline’s offsite — Asheville', date: '2026-05-22', sub: '' },
    { name: 'Mom’s birthday', date: '2026-06-03', sub: 'Atlanta' },
    { name: 'Anniversary trip — Savannah', date: '2026-09-10', sub: '' },
  ];
}

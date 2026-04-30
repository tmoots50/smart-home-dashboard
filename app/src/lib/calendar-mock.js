// Mock calendar. Three sections: Family, Tim (Work), Caroline (Work).
// Widget highlights the single soonest upcoming event globally.

export function getMockCalendar(now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const at = (h, m) => {
    const d = new Date(today);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  const sections = [
    {
      label: 'Family',
      events: [
        { id: 'fam-1', startsAt: at(8, 30), title: 'Pediatrician — Mabel 1mo', sub: 'Northside Pediatrics' },
        { id: 'fam-2', startsAt: at(18, 30), title: 'Dinner at home', sub: '' },
      ],
    },
    {
      label: 'Tim (Work)',
      events: [
        { id: 'tim-1', startsAt: at(14, 15), title: 'Job-search standup', sub: '30 min · Zoom' },
        { id: 'tim-2', startsAt: at(16, 0),  title: 'Recruiter call — Tessa', sub: 'Phone' },
      ],
    },
    {
      label: 'Caroline (Work)',
      events: [
        { id: 'car-1', startsAt: at(9, 0),   title: 'Product sync', sub: 'Carter’s HQ' },
        { id: 'car-2', startsAt: at(11, 0),  title: 'Coffee with Sara', sub: 'Octane Coffee' },
        { id: 'car-3', startsAt: at(15, 30), title: 'Strategy review', sub: 'Carter’s HQ' },
      ],
    },
  ];

  // Soonest upcoming event across all sections.
  let nextEventId = null;
  let nextStart = null;
  for (const section of sections) {
    for (const event of section.events) {
      const start = new Date(event.startsAt);
      if (start > now && (!nextStart || start < nextStart)) {
        nextStart = start;
        nextEventId = event.id;
      }
    }
  }

  return { sections, nextEventId };
}

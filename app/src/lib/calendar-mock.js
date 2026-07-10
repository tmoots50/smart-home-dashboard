// Mock calendar mirrors production reality: Family + Tim are connected;
// Caroline remains an explicit unlinked placeholder until her work calendar
// is actually integrated.
// Widget highlights the single soonest upcoming event globally.

// Mock for the expanded 7-day overlay (matches /api/calendar/upcoming shape).
// Mix of timed + all-day events across all three calendars.
export function getMockUpcoming(now = new Date()) {
  const day = (offset) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const at = (offset, h, m) => {
    const d = day(offset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return [
    { id: 'u1', calendar: 'Family', title: 'Pediatrician — Mabel 2mo', sub: 'Northside Pediatrics', description: 'Check weight, milestones, vaccines. Bring insurance card.', startsAt: at(0, 15, 30), endsAt: at(0, 16, 15), allDay: false },
    { id: 'u2', calendar: 'Tim', title: 'Recruiter call — Tessa', sub: 'Phone', description: 'Director PM role at fintech startup. Pre-screen, 30 min.', startsAt: at(1, 10, 0), endsAt: at(1, 10, 30), allDay: false },
    { id: 'u3', calendar: 'Family', title: 'Grandma visiting', sub: '', description: '', startsAt: ymd(day(2)), endsAt: ymd(day(4)), allDay: true },
    { id: 'u4', calendar: 'Caroline', title: 'Back-to-office day', sub: "Carter's HQ", description: '', startsAt: at(3, 9, 0), endsAt: at(3, 17, 0), allDay: false },
    { id: 'u5', calendar: 'Family', title: 'Swim lesson — intro', sub: 'Piedmont Aquatic', description: 'Bring swim diaper and towel.', startsAt: at(5, 11, 0), endsAt: at(5, 11, 45), allDay: false },
    { id: 'u6', calendar: 'Tim', title: 'Dentist', sub: 'Midtown Dental', description: 'Cleaning + X-rays. 4615 Peachtree Rd NE, Suite 200.', startsAt: at(6, 14, 0), endsAt: at(6, 15, 0), allDay: false },
  ];
}

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
      label: 'Tim',
      events: [
        { id: 'tim-1', startsAt: at(14, 15), endsAt: at(14, 45), title: 'Job-search standup', sub: '30 min · Zoom', description: 'Weekly check-in with recruiter network.' },
        { id: 'tim-2', startsAt: at(16, 0),  endsAt: at(16, 30), title: 'Recruiter call — Tessa', sub: 'Phone', description: 'Director PM role at fintech startup.' },
      ],
    },
    {
      label: 'Family',
      events: [
        { id: 'fam-1', startsAt: at(8, 30), endsAt: at(9, 15), title: 'Pediatrician — Mabel 1mo', sub: 'Northside Pediatrics', description: 'Check weight, milestones, vaccines.' },
        { id: 'fam-2', startsAt: at(18, 30), endsAt: at(19, 30), title: 'Dinner at home', sub: '', description: '' },
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

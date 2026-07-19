// Mock calendar mirrors production reality: four source calendars merged into
// three person columns — Family, Tim (personal + Narvar work interleaved,
// work events tagged), Caroline (Outlook work feed, read-only).
// Widget highlights the single soonest upcoming event globally.
//
// Every mock event carries the full multi-source contract (calendar/person/
// kind/readOnly) because fixtures feed widgets DIRECTLY — no
// canonicalizeUpcoming backfill runs on the harness path.

// Fill contract defaults for events written before the multi-source split.
const withMeta = (e) => ({
  ...e,
  person: e.person ?? e.calendar,
  kind: e.kind ?? 'personal',
  readOnly: e.readOnly ?? false,
});

// Mock for expanded/Coming Up views.
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
    { id: 'u5', calendar: 'Family', title: 'Swim lesson — intro', sub: 'Piedmont Aquatic', description: 'Bring swim diaper and towel.', startsAt: at(5, 11, 0), endsAt: at(5, 11, 45), allDay: false },
    { id: 'u6', calendar: 'Tim', title: 'Dentist', sub: 'Midtown Dental', description: 'Cleaning + X-rays. 4615 Peachtree Rd NE, Suite 200.', startsAt: at(6, 14, 0), endsAt: at(6, 15, 0), allDay: false },
    // Tim's Narvar work calendar — interleaves into his column with a Work tag.
    { id: 'uw1', calendar: 'Tim (Work)', person: 'Tim', kind: 'work', title: 'Product review — Track', sub: 'Zoom', description: 'Q3 roadmap checkpoint with eng leads.', startsAt: at(0, 13, 0), endsAt: at(0, 14, 0), allDay: false },
    { id: 'uw2', calendar: 'Tim (Work)', person: 'Tim', kind: 'work', title: 'Narvar leadership sync', sub: 'Zoom', description: '', startsAt: at(2, 11, 0), endsAt: at(2, 11, 45), allDay: false },
    // Caroline's Outlook work feed — read-only ICS.
    { id: 'uc1', calendar: 'Caroline (Work)', person: 'Caroline', kind: 'work', readOnly: true, title: 'Quarterly planning', sub: 'Conf Rm 4B', description: '', startsAt: at(1, 9, 0), endsAt: at(1, 11, 0), allDay: false },
    { id: 'uc2', calendar: 'Caroline (Work)', person: 'Caroline', kind: 'work', readOnly: true, title: 'Client presentation', sub: 'Teams', description: 'Renewal pitch deck run-through.', startsAt: at(4, 13, 30), endsAt: at(4, 14, 30), allDay: false },
    // Dense near-term Family events — these occupy the calendar card's six
    // per-person slots, so the Coming-Up left pane (which excludes whatever
    // the card shows) still has agenda material below. Mirrors the real
    // household calendar's rhythm.
    { id: 'u14', calendar: 'Family', title: 'Water hanging planters', sub: '', description: '', startsAt: at(0, 20, 0), endsAt: at(0, 20, 15), allDay: false, recurring: true },
    { id: 'u15', calendar: 'Family', title: 'Lunch with Mom', sub: '', description: '', startsAt: at(1, 12, 0), endsAt: at(1, 13, 0), allDay: false },
    { id: 'u16', calendar: 'Family', title: 'Water hanging planters', sub: '', description: '', startsAt: at(1, 20, 0), endsAt: at(1, 20, 15), allDay: false, recurring: true },
    { id: 'u17', calendar: 'Family', title: 'Stroller walk with the Fregos', sub: '', description: '', startsAt: at(2, 9, 0), endsAt: at(2, 10, 0), allDay: false },
    { id: 'u18', calendar: 'Family', title: 'Trash & recycling out', sub: '', description: '', startsAt: at(2, 19, 0), endsAt: at(2, 19, 15), allDay: false, recurring: true },
    // Next-4-weeks agenda + plan-ahead material so the two-pane Coming-Up
    // card demos both panes (birthday / recurring / Mabel / travel colors).
    { id: 'u7', calendar: 'Family', title: "Aidan's 3rd Birthday", sub: '3012 Andora Dr SW, Marietta, GA', description: '', startsAt: at(9, 15, 30), endsAt: at(9, 17, 0), allDay: false },
    { id: 'u8', calendar: 'Family', title: 'Give Chloe heartworm pill', sub: '', description: '', startsAt: at(11, 8, 0), endsAt: at(11, 8, 15), allDay: false, recurring: true },
    { id: 'u9', calendar: 'Family', title: '4 month check up', sub: 'Lighthouse Pediatrics, 3610 Piedmont Rd NE', description: '', startsAt: at(17, 9, 30), endsAt: at(17, 10, 15), allDay: false },
    { id: 'u10', calendar: 'Tim', title: 'Flight to NYC — Delta 1043', sub: 'ATL → LGA', description: '', startsAt: at(24, 8, 15), endsAt: at(24, 10, 45), allDay: false },
    { id: 'u11', calendar: 'Family', title: 'Stay at Hamilton', sub: 'Hamilton, GA', description: '', startsAt: ymd(day(38)), endsAt: ymd(day(41)), allDay: true },
    { id: 'u12', calendar: 'Tim (Work)', person: 'Tim', kind: 'work', title: 'Narvar team offsite', sub: 'Austin, TX', description: '', startsAt: ymd(day(55)), endsAt: ymd(day(58)), allDay: true },
    { id: 'u13', calendar: 'Family', title: 'Baby shower for Kate', sub: '', description: '', startsAt: at(70, 14, 0), endsAt: at(70, 16, 0), allDay: false },
  ].map(withMeta);
}

// Deterministic month of household events for the month-calendar overlay.
// All four source calendars. Pure in (year, month) — same input, same events.
export function getMockMonth(year, month) {
  const at = (day, h, m = 0) => new Date(year, month, day, h, m).toISOString();
  const ymd = (day) => {
    const d = new Date(year, month, day);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const events = [];

  // Family: swim lesson every Saturday at 11:00.
  for (let day = 1; day <= daysInMonth; day++) {
    if (new Date(year, month, day).getDay() === 6) {
      events.push({ id: `m-swim-${day}`, calendar: 'Family', title: 'Swim lesson', sub: 'Piedmont Aquatic', description: 'Bring swim diaper and towel.', startsAt: at(day, 11, 0), endsAt: at(day, 11, 45), allDay: false });
    }
  }
  // Tim: recruiter sync every Wednesday at 10:00.
  for (let day = 1; day <= daysInMonth; day++) {
    if (new Date(year, month, day).getDay() === 3) {
      events.push({ id: `m-rec-${day}`, calendar: 'Tim', title: 'Recruiter sync', sub: 'Phone', description: '', startsAt: at(day, 10, 0), endsAt: at(day, 10, 30), allDay: false });
    }
  }
  // Tim (Work): product sync every Tuesday at 14:00.
  for (let day = 1; day <= daysInMonth; day++) {
    if (new Date(year, month, day).getDay() === 2) {
      events.push({ id: `m-work-${day}`, calendar: 'Tim (Work)', person: 'Tim', kind: 'work', title: 'Narvar product sync', sub: 'Zoom', description: '', startsAt: at(day, 14, 0), endsAt: at(day, 14, 30), allDay: false });
    }
  }
  // Caroline (Work): team standup every Monday at 9:30.
  for (let day = 1; day <= daysInMonth; day++) {
    if (new Date(year, month, day).getDay() === 1) {
      events.push({ id: `m-car-${day}`, calendar: 'Caroline (Work)', person: 'Caroline', kind: 'work', readOnly: true, title: 'Team standup', sub: 'Teams', description: '', startsAt: at(day, 9, 30), endsAt: at(day, 10, 0), allDay: false });
    }
  }
  events.push(
    { id: 'm-pedi', calendar: 'Family', title: 'Pediatrician — Mabel', sub: 'Northside Pediatrics', description: 'Check weight, milestones, vaccines.', startsAt: at(12, 15, 30), endsAt: at(12, 16, 15), allDay: false },
    { id: 'm-grandma', calendar: 'Family', title: 'Grandma visiting', sub: '', description: '', startsAt: ymd(14), endsAt: ymd(17), allDay: true },
    { id: 'm-dentist', calendar: 'Tim', title: 'Dentist', sub: 'Midtown Dental', description: 'Cleaning + X-rays.', startsAt: at(20, 14, 0), endsAt: at(20, 15, 0), allDay: false },
    { id: 'm-offsite', calendar: 'Caroline (Work)', person: 'Caroline', kind: 'work', readOnly: true, title: 'Offsite', sub: 'Downtown', description: '', startsAt: ymd(24), endsAt: ymd(26), allDay: true },
  );
  return events
    .map(withMeta)
    .sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
}

export function getMockCalendar(now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const at = (h, m) => {
    const d = new Date(today);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  // Sections are keyed by PERSON (matches /api/calendar's mergeSections) —
  // Tim's section carries personal AND work events, chronologically.
  const sections = [
    {
      label: 'Tim',
      events: [
        { id: 'tim-1', calendar: 'Tim', startsAt: at(14, 15), endsAt: at(14, 45), title: 'Job-search standup', sub: '30 min · Zoom', description: 'Weekly check-in with recruiter network.' },
        { id: 'tim-w1', calendar: 'Tim (Work)', person: 'Tim', kind: 'work', startsAt: at(15, 0), endsAt: at(16, 0), title: 'Product review — Track', sub: 'Zoom', description: 'Q3 roadmap checkpoint with eng leads.' },
        { id: 'tim-2', calendar: 'Tim', startsAt: at(16, 0), endsAt: at(16, 30), title: 'Recruiter call — Tessa', sub: 'Phone', description: 'Director PM role at fintech startup.' },
      ].map(withMeta),
    },
    {
      label: 'Family',
      events: [
        { id: 'fam-1', calendar: 'Family', startsAt: at(8, 30), endsAt: at(9, 15), title: 'Pediatrician — Mabel 1mo', sub: 'Northside Pediatrics', description: 'Check weight, milestones, vaccines.' },
        { id: 'fam-2', calendar: 'Family', startsAt: at(18, 30), endsAt: at(19, 30), title: 'Dinner at home', sub: '', description: '' },
      ].map(withMeta),
    },
    {
      label: 'Caroline',
      events: [
        { id: 'car-w1', calendar: 'Caroline (Work)', person: 'Caroline', kind: 'work', readOnly: true, startsAt: at(9, 30), endsAt: at(10, 0), title: 'Team standup', sub: 'Teams', description: '' },
        { id: 'car-w2', calendar: 'Caroline (Work)', person: 'Caroline', kind: 'work', readOnly: true, startsAt: at(13, 30), endsAt: at(14, 30), title: 'Client presentation', sub: 'Teams', description: 'Renewal pitch deck run-through.' },
      ].map(withMeta),
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

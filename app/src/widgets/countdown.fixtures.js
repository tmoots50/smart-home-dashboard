const NOW = new Date();
function at(offset, hour = 10) {
  const d = new Date(NOW); d.setDate(d.getDate() + offset); d.setHours(hour, 0, 0, 0); return d.toISOString();
}
function event(i, calendar = 'Family') {
  return { id: `event-${i}`, calendar, title: `Family event ${i}`, startsAt: at(i, 8 + (i % 10)), sub: i % 2 ? 'Piedmont Park, Atlanta' : '' };
}
export const states = {
  empty: [],
  typical: [event(0), event(1), event(2)],
  mixed: [event(0), event(1, 'Tim'), event(2, 'Caroline'), event(3)],
  overflow: Array.from({ length: 14 }, (_, i) => event(i)),
};

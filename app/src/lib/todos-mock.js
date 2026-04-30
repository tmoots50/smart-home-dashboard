// Mock today's misc todos. Today-only items, each with assignee + due date.

export function getMockTodos() {
  return [
    { text: 'Stroller walk before noon', owner: 'Tim', due: '2026-04-30', done: false },
    { text: 'Email pediatrician about feeding', owner: 'Caroline', due: '2026-04-30', done: false },
    { text: 'Pull out 0–3 mo onesies', owner: 'Tim', due: '2026-04-29', done: true },
    { text: 'Drink water', owner: 'Caroline', due: '2026-04-30', done: false },
    { text: 'Book newborn portraits', owner: 'Tim', due: '2026-05-04', done: false },
  ];
}

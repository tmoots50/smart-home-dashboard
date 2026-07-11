function item(i, done = false) {
  return { id: `todo-${i}`, text: `Household task ${i + 1}${i % 3 === 0 ? ' with a longer line of useful detail' : ''}`, owner: i % 2 ? 'Tim' : 'Caroline', done };
}
export const states = {
  empty: [],
  typical: [item(0), item(1), item(2, true), item(3)],
  overflow: Array.from({ length: 16 }, (_, i) => item(i, i === 2)),
  // Worst-case text: a long multi-word task (must wrap, not clip) and a long
  // single token (must break, not widen the card).
  worst: [
    { id: 'worst-1', text: 'Call the pediatric practice about the insurance pre-authorization paperwork for the follow-up appointment', owner: 'Tim', done: false },
    { id: 'worst-2', text: 'Supercalifragilisticexpialidocious-unbreakable-token-that-must-wrap-not-widen', owner: 'Caroline', done: false },
  ],
};

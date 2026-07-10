function item(i, done = false) {
  return { id: `todo-${i}`, text: `Household task ${i + 1}${i % 3 === 0 ? ' with a longer line of useful detail' : ''}`, owner: i % 2 ? 'Tim' : 'Caroline', done };
}
export const states = {
  empty: [],
  typical: [item(0), item(1), item(2, true), item(3)],
  overflow: Array.from({ length: 16 }, (_, i) => item(i, i === 2)),
};

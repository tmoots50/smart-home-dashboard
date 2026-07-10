function item(i, done = false) {
  return { id: `grocery-${i}`, text: `Grocery item ${i + 1}${i % 4 === 0 ? ' in the family-size package' : ''}`, qty: i % 2 ? '2' : '', done };
}
export const states = {
  empty: [],
  typical: [item(0), item(1), item(2, true), item(3)],
  overflow: Array.from({ length: 14 }, (_, i) => item(i, i === 2)),
};

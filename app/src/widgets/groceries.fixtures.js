function item(i, done = false) {
  return { id: `grocery-${i}`, text: `Grocery item ${i + 1}${i % 4 === 0 ? ' in the family-size package' : ''}`, qty: i % 2 ? '2' : '', done };
}
export const states = {
  empty: [],
  typical: [item(0), item(1), item(2, true), item(3)],
  overflow: Array.from({ length: 14 }, (_, i) => item(i, i === 2)),
  // Worst-case text: long multi-word item (wraps) and a long single token
  // (breaks instead of widening the card).
  worst: [
    { id: 'worst-1', text: 'Family-size case of the sparkling water Caroline likes from the international aisle', qty: '2', done: false },
    { id: 'worst-2', text: 'Weißwürste-mit-süßem-Senf-extra-long-unbreakable-product-name', qty: '', done: false },
  ],
};

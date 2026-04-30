// Mock groceries list. Items are { text, qty?, done }.

export function getMockGroceries() {
  return [
    { text: 'Whole milk', qty: '1 gal', done: false },
    { text: 'Diapers (size 1)', qty: '2 boxes', done: false },
    { text: 'Bananas', qty: '', done: true },
    { text: 'Coffee beans', qty: '1 lb', done: false },
    { text: 'Frozen berries', qty: '', done: false },
  ];
}

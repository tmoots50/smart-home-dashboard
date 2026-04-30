// Mock chores: recurring, assigned household work. Real source TBD.

export function getMockChores() {
  return [
    { text: 'Take out trash + recycling', owner: 'Tim', done: false },
    { text: 'Water plants', owner: 'Tim', done: true },
    { text: 'Sweep porch', owner: 'Tim', done: false },
    { text: 'Wash bottles + pump parts', owner: 'Caroline', done: false },
    { text: 'Run dishwasher', owner: 'Caroline', done: true },
    { text: 'Sort baby laundry', owner: 'Caroline', done: false },
  ];
}

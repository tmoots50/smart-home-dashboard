import { getMockPicks } from '../lib/pick-mock.js';

export const states = {
  empty: [],
  typical: getMockPicks(),
  overflow: getMockPicks().map((p, i) => ({
    ...p,
    title: `${p.title} — an intentionally long Atlanta headline that must stay compact on the wall display ${i + 1}`,
    note: `${p.note} Extra context tests clamping and internal scrolling without widening the card.`,
  })),
};

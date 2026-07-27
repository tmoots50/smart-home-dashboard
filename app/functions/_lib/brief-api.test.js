import { describe, it, expect } from 'vitest';
import { normalizeBrief, BODY_MAX, SECTIONS_MAX, ITEMS_MAX } from './brief-api.js';

const NOW = '2026-07-27T11:30:00.000Z';

const valid = () => ({
  date: '2026-07-27',
  headline: 'Clear morning, stacked afternoon.',
  bodyTitle: '🗞️ Headlines',
  body: ['🏫 **The week’s story is childcare.** Settle who has Mabel.'],
  sections: [
    { kind: 'today', title: '🗓️ Today', items: [{ time: 'Morning', text: 'Clear until noon' }] },
  ],
  closer: '94 today, 99 tomorrow.',
});

describe('normalizeBrief', () => {
  it('accepts a valid brief and stamps generatedAt', () => {
    const r = normalizeBrief(valid(), NOW);
    expect(r.ok).toBe(true);
    expect(r.value.generatedAt).toBe(NOW);
    expect(r.value.date).toBe('2026-07-27');
    expect(r.value.body).toHaveLength(1);
    expect(r.value.sections[0].items[0]).toEqual({ time: 'Morning', text: 'Clear until noon' });
  });

  it('rejects non-object payloads', () => {
    for (const bad of [null, [], 'hi', 42]) {
      expect(normalizeBrief(bad, NOW).ok).toBe(false);
    }
  });

  it('rejects a missing or malformed date', () => {
    expect(normalizeBrief({ ...valid(), date: undefined }, NOW).ok).toBe(false);
    expect(normalizeBrief({ ...valid(), date: 'July 27' }, NOW).ok).toBe(false);
    expect(normalizeBrief({ ...valid(), date: '2026-7-27' }, NOW).ok).toBe(false);
  });

  it('rejects a brief with no content at all', () => {
    const r = normalizeBrief({ date: '2026-07-27' }, NOW);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no content/);
  });

  it('drops malformed items and empty sections instead of failing', () => {
    const r = normalizeBrief({
      ...valid(),
      sections: [
        { kind: 'today', title: 'Today', items: [{ text: '' }, { text: 'kept' }, 'junk'] },
        { kind: 'meals', title: 'Meals', items: [] },      // empty → dropped
        'not-a-section',
      ],
    }, NOW);
    expect(r.ok).toBe(true);
    expect(r.value.sections).toHaveLength(1);
    expect(r.value.sections[0].items).toEqual([{ text: 'kept' }]);
  });

  it('clamps body, sections, and items to their caps', () => {
    const r = normalizeBrief({
      ...valid(),
      body: Array.from({ length: BODY_MAX + 3 }, (_, i) => `p${i}`),
      sections: Array.from({ length: SECTIONS_MAX + 2 }, (_, i) => ({
        kind: 'note', title: `s${i}`,
        items: Array.from({ length: ITEMS_MAX + 4 }, (_, j) => ({ text: `i${j}` })),
      })),
    }, NOW);
    expect(r.ok).toBe(true);
    expect(r.value.body).toHaveLength(BODY_MAX);
    expect(r.value.sections).toHaveLength(SECTIONS_MAX);
    expect(r.value.sections[0].items).toHaveLength(ITEMS_MAX);
  });

  it('defaults a missing section kind to "note" and drops missing time', () => {
    const r = normalizeBrief({
      ...valid(),
      sections: [{ title: 'House', items: [{ text: 'no time here' }] }],
    }, NOW);
    expect(r.value.sections[0].kind).toBe('note');
    expect(r.value.sections[0].items[0]).not.toHaveProperty('time');
  });

  it('normalizes kind: "checkin" passes through, everything else is "morning"', () => {
    expect(normalizeBrief({ ...valid(), kind: 'checkin' }, NOW).value.kind).toBe('checkin');
    expect(normalizeBrief(valid(), NOW).value.kind).toBe('morning');
    for (const junk of ['CHECKIN', 'evening', 42, null, { k: 1 }]) {
      expect(normalizeBrief({ ...valid(), kind: junk }, NOW).value.kind).toBe('morning');
    }
  });

  it('omits bodyTitle when absent and nulls an empty closer', () => {
    const r = normalizeBrief({ ...valid(), bodyTitle: undefined, closer: '' }, NOW);
    expect(r.value).not.toHaveProperty('bodyTitle');
    expect(r.value.closer).toBeNull();
  });
});

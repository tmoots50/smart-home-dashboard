import { describe, expect, it } from 'vitest';
import { mergePicks } from './curated.js';

describe('mergePicks', () => {
  it('fills a single curated pick with two feed candidates', () => {
    const result = mergePicks(
      [{ title: 'Curated', url: 'https://example.com/curated' }],
      [{ title: 'Feed 1', url: 'https://example.com/1' }, { title: 'Feed 2', url: 'https://example.com/2' }],
    );
    expect(result.map(p => p.title)).toEqual(['Curated', 'Feed 1', 'Feed 2']);
  });

  it('deduplicates by link and caps the card at three', () => {
    const duplicate = { title: 'Duplicate', url: 'https://example.com/same' };
    const result = mergePicks([duplicate], [{ ...duplicate, title: 'Same link' }], [
      { title: 'Two', url: 'https://example.com/2' },
      { title: 'Three', url: 'https://example.com/3' },
      { title: 'Four', url: 'https://example.com/4' },
    ]);
    expect(result).toHaveLength(3);
    expect(result.map(p => p.title)).toEqual(['Duplicate', 'Two', 'Three']);
  });
});

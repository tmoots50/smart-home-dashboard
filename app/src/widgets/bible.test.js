import { describe, it, expect } from 'vitest';
import { renderBible } from './bible.js';
import { getMockBibleVerse } from '../lib/bible-mock.js';

describe('renderBible', () => {
  it('renders verse text and reference', () => {
    const v = getMockBibleVerse(new Date('2026-04-29'));
    const html = renderBible(v);
    expect(html).toContain(v.text);
    expect(html).toContain(v.ref);
  });

  it('returns empty string when there is no verse', () => {
    expect(renderBible(null)).toBe('');
  });

  it('rotates by day of year', () => {
    const a = getMockBibleVerse(new Date('2026-01-01'));
    const b = getMockBibleVerse(new Date('2026-01-02'));
    expect(a.ref).not.toBe(b.ref);
  });

  it('escapes HTML in verse text', () => {
    const html = renderBible({ text: '<x>', ref: '<y>' });
    expect(html).not.toContain('<x>');
    expect(html).not.toContain('<y>');
  });
});

import { describe, it, expect } from 'vitest';
import { renderBible, fitBible } from './bible.js';
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

// happy-dom reports 0 for layout metrics, so drive fitBible with a stub
// element whose scrollWidth responds to the font size it sets.
describe('fitBible', () => {
  const stub = (widthAtRem) => {
    const el = {
      style: {},
      clientWidth: 400,
      get scrollWidth() {
        const size = parseFloat(el.style.fontSize ?? '0.95');
        return widthAtRem(size);
      },
    };
    return { querySelector: (sel) => (sel === '.bible__text' ? el : null), el };
  };

  it('keeps the starting size when the verse already fits', () => {
    const c = stub(() => 300);
    fitBible(c);
    expect(c.el.style.fontSize).toBe('0.95rem');
  });

  it('shrinks until the verse fits on one line', () => {
    // overflows above 0.8rem, fits at or below
    const c = stub((size) => (size > 0.8 ? 500 : 380));
    fitBible(c);
    expect(parseFloat(c.el.style.fontSize)).toBeLessThanOrEqual(0.8);
    expect(parseFloat(c.el.style.fontSize)).toBeGreaterThanOrEqual(0.65);
  });

  it('stops at the floor and leaves the ellipsis to CSS', () => {
    const c = stub(() => 5000); // never fits
    fitBible(c);
    expect(c.el.style.fontSize).toBe('0.65rem');
  });

  it('tolerates a missing container or text node', () => {
    expect(() => fitBible(null)).not.toThrow();
    expect(() => fitBible({ querySelector: () => null })).not.toThrow();
  });
});

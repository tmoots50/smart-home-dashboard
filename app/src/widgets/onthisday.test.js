import { describe, it, expect } from 'vitest';
import { renderOnThisDay } from './onthisday.js';
import { getMockOnThisDay } from '../lib/onthisday-mock.js';

describe('renderOnThisDay', () => {
  it('renders the year and the fact', () => {
    const data = getMockOnThisDay(new Date('2026-05-01T08:00:00'));
    const html = renderOnThisDay(data);
    expect(html).toContain('1931');
    expect(html).toContain('Empire State Building');
  });

  it('returns empty string when no data', () => {
    expect(renderOnThisDay(null)).toBe('');
  });

  it('escapes HTML in the fact', () => {
    const html = renderOnThisDay({ year: 2026, fact: '<script>x</script>' });
    expect(html).not.toContain('<script>');
  });
});

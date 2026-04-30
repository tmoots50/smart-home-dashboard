import { describe, it, expect } from 'vitest';
import { renderHeadlines } from './headlines.js';
import { getMockHeadlines } from '../lib/headlines-mock.js';

describe('renderHeadlines', () => {
  it('renders at most 3 rows', () => {
    const items = [
      { source: 'A', title: 'one' },
      { source: 'B', title: 'two' },
      { source: 'C', title: 'three' },
      { source: 'D', title: 'four' },
    ];
    const html = renderHeadlines(items);
    const rows = html.match(/class="headlines__item"/g) || [];
    expect(rows.length).toBe(3);
    expect(html).not.toContain('four');
  });

  it('renders headlines from the mock', () => {
    const items = getMockHeadlines();
    const html = renderHeadlines(items);
    expect(html).toContain(items[0].title);
    expect(html).toContain(items[0].source);
  });

  it('returns empty string when there are no headlines', () => {
    expect(renderHeadlines([])).toBe('');
  });

  it('escapes HTML in titles', () => {
    const html = renderHeadlines([{ source: 'X', title: '<a>boom</a>' }]);
    expect(html).not.toContain('<a>boom</a>');
  });
});

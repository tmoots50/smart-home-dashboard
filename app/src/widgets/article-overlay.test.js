import { describe, it, expect, afterEach } from 'vitest';
import { renderArticleOverlay, openArticleOverlay } from './article-overlay.js';

const pick = { url: 'https://example.com/patios', source: 'Atlanta Magazine', title: 'Best patios' };

afterEach(() => {
  document.querySelectorAll('.overlay').forEach(el => el.remove());
  document.documentElement.classList.remove('has-overlay');
});

describe('renderArticleOverlay', () => {
  it('renders header (Back, source, external link) over the iframe', () => {
    const html = renderArticleOverlay(pick);
    expect(html).toContain('article-overlay__back');
    expect(html).toContain('Atlanta Magazine');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('<iframe class="article-overlay__frame" src="https://example.com/patios"');
  });

  it('escapes HTML in source, title, and url', () => {
    const html = renderArticleOverlay({
      url: 'https://example.com/?a=1&b=2',
      source: '<img src=x onerror=1>',
      title: '<b>bold</b>',
    });
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>bold</b>');
    expect(html).toContain('https://example.com/?a=1&amp;b=2');
  });

  it('keeps the hint layer behind the frame in source order', () => {
    const html = renderArticleOverlay(pick);
    expect(html.indexOf('article-overlay__hint')).toBeLessThan(html.indexOf('article-overlay__frame'));
  });
});

describe('openArticleOverlay', () => {
  it('throws on javascript: and data: urls', () => {
    expect(() => openArticleOverlay({ url: 'javascript:alert(1)' })).toThrow();
    expect(() => openArticleOverlay({ url: 'data:text/html,hi' })).toThrow();
    expect(document.querySelector('.overlay')).toBeNull();
  });

  it('accepts same-origin relative stubs (harness) and http(s)', () => {
    const close = openArticleOverlay({ ...pick, url: '/qa/article-stub.html' });
    expect(document.querySelector('.article-overlay')).not.toBeNull();
    close();
  });

  it('mounts, locks scroll, and closes on Back', () => {
    openArticleOverlay(pick);
    expect(document.documentElement.classList.contains('has-overlay')).toBe(true);
    document.querySelector('.article-overlay__back').click();
    expect(document.querySelector('.overlay')).toBeNull();
    expect(document.documentElement.classList.contains('has-overlay')).toBe(false);
  });

  it('closes on Escape', () => {
    openArticleOverlay(pick);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.overlay')).toBeNull();
  });
});

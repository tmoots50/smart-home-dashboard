import { describe, it, expect, vi } from 'vitest';
import { renderPick, attachPickHandlers } from './pick.js';
import { getMockPick } from '../lib/pick-mock.js';

describe('renderPick', () => {
  it('renders the mock pick with title and note', () => {
    const html = renderPick(getMockPick());
    const p = getMockPick();
    expect(html).toContain('Atlanta Pick');
    expect(html).toContain(p.source);
    expect(html).toContain(p.note);
  });

  it('links the whole item for an http(s) url', () => {
    const html = renderPick({ title: 'Hozier @ Fox', url: 'https://foxtheatre.org/x', note: 'go' });
    expect(html).toContain('<a class="pick__item" href="https://foxtheatre.org/x"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('<span class="pick__title">Hozier @ Fox</span>');
  });

  it('does NOT link a javascript: url — renders as plain article, no href', () => {
    const html = renderPick({ title: 'boom', url: 'javascript:alert(1)' });
    expect(html).not.toContain('href');
    expect(html).toContain('<article class="pick__item">');
    expect(html).toContain('<span class="pick__title">boom</span>');
  });

  it('renders a title with no url as plain text', () => {
    const html = renderPick({ title: 'no link', url: '' });
    expect(html).not.toContain('<a ');
    expect(html).toContain('no link');
  });

  it('escapes HTML in the title and note', () => {
    const html = renderPick({ title: '<img src=x onerror=1>', note: '<b>hi</b>', url: 'https://x/y' });
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>hi</b>');
  });

  it('omits the note line when there is no note', () => {
    const html = renderPick({ title: 'x', url: 'https://x/y' });
    expect(html).not.toContain('pick__note');
  });

  it('returns empty string when there is no pick', () => {
    expect(renderPick(null)).toBe('');
    expect(renderPick({})).toBe('');
  });
});

describe('attachPickHandlers', () => {
  it('intercepts a pick tap: prevents navigation, opens the article overlay', () => {
    const el = document.createElement('div');
    el.innerHTML = renderPick({ title: 'Hozier @ Fox', url: 'https://foxtheatre.org/x', note: 'go', source: 'Fox Theatre' });
    const openArticle = vi.fn();
    attachPickHandlers(el, { openArticle });

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.querySelector('a.pick__item').dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(openArticle).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://foxtheatre.org/x',
      source: 'Fox Theatre',
      title: 'Hozier @ Fox',
    }));
  });

  it('ignores taps on unlinked picks', () => {
    const el = document.createElement('div');
    el.innerHTML = renderPick({ title: 'no link', url: '' });
    const openArticle = vi.fn();
    attachPickHandlers(el, { openArticle });
    el.querySelector('.pick__item').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(openArticle).not.toHaveBeenCalled();
  });
});

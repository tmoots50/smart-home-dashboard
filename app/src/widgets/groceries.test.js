import { describe, it, expect } from 'vitest';
import { renderGroceries, mountGroceries } from './groceries.js';
import { getMockGroceries } from '../lib/groceries-mock.js';

describe('renderGroceries', () => {
  it('renders one row per grocery item', () => {
    const items = getMockGroceries();
    const html = renderGroceries(items);
    for (const item of items) {
      expect(html).toContain(item.text);
    }
  });

  it('renders qty when present', () => {
    const html = renderGroceries(getMockGroceries());
    expect(html).toContain('1 gal');
  });

  it('marks done items', () => {
    const html = renderGroceries([{ text: 'x', qty: '', done: true }]);
    expect(html).toContain('groceries__check--done');
    expect(html).toContain('groceries__text--done');
  });

  it('shows empty state', () => {
    const html = renderGroceries([]);
    expect(html).toContain('List is empty');
  });

  it('renders add / edit / delete buttons', () => {
    const html = renderGroceries(getMockGroceries());
    expect(html).toContain('data-action="add"');
    expect(html).toContain('data-action="edit"');
    expect(html).toContain('data-action="delete"');
  });
});

describe('mountGroceries', () => {
  it('toggles done state on click', () => {
    const slot = document.createElement('div');
    mountGroceries(slot, [{ text: 'milk', qty: '', done: false }]);
    expect(slot.querySelector('.groceries__check--done')).toBeNull();
    slot.querySelector('[data-action="toggle"]').click();
    expect(slot.querySelector('.groceries__check--done')).not.toBeNull();
  });
});

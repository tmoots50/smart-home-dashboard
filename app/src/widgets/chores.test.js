import { describe, it, expect } from 'vitest';
import { renderChores, mountChores } from './chores.js';
import { getMockChores } from '../lib/chores-mock.js';

describe('renderChores', () => {
  it('groups items by owner', () => {
    const html = renderChores(getMockChores());
    expect(html).toContain('>Tim<');
    expect(html).toContain('>Caroline<');
  });

  it('renders one row per chore across all groups', () => {
    const chores = getMockChores();
    const html = renderChores(chores);
    for (const c of chores) {
      expect(html).toContain(c.text);
    }
  });

  it('marks done items', () => {
    const html = renderChores([{ text: 'x', owner: 'Tim', done: true }]);
    expect(html).toContain('chores__check--done');
  });

  it('shows empty group label when an owner has no chores', () => {
    const html = renderChores([{ text: 'x', owner: 'Tim', done: false }]);
    expect(html).toContain('All clear');
  });

  it('renders add / edit / delete buttons', () => {
    const html = renderChores(getMockChores());
    expect(html).toContain('data-action="add"');
    expect(html).toContain('data-action="edit"');
    expect(html).toContain('data-action="delete"');
  });
});

describe('mountChores', () => {
  it('toggles done on click', () => {
    const slot = document.createElement('div');
    mountChores(slot, [{ text: 'x', owner: 'Tim', done: false }]);
    expect(slot.querySelector('.chores__check--done')).toBeNull();
    slot.querySelector('[data-action="toggle"]').click();
    expect(slot.querySelector('.chores__check--done')).not.toBeNull();
  });
});

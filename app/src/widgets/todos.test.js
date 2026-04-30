import { describe, it, expect } from 'vitest';
import { renderTodos, mountTodos } from './todos.js';
import { getMockTodos } from '../lib/todos-mock.js';

const NOW = new Date('2026-04-30T08:00:00');

describe('renderTodos', () => {
  it('renders one row per todo with assignee', () => {
    const todos = getMockTodos();
    const html = renderTodos(todos, NOW);
    for (const t of todos) {
      expect(html).toContain(t.text);
      expect(html).toContain(t.owner);
    }
  });

  it('formats due dates as Today / Tomorrow / Overdue / Mon D', () => {
    const items = [
      { text: 'a', owner: 'Tim', due: '2026-04-30', done: false },
      { text: 'b', owner: 'Tim', due: '2026-05-01', done: false },
      { text: 'c', owner: 'Tim', due: '2026-04-29', done: false },
      { text: 'd', owner: 'Tim', due: '2026-05-04', done: false },
    ];
    const html = renderTodos(items, NOW);
    expect(html).toContain('Today');
    expect(html).toContain('Tomorrow');
    expect(html).toContain('Overdue');
    expect(html).toMatch(/May 4|May\s4/);
  });

  it('applies overdue and today classes', () => {
    const items = [
      { text: 'a', owner: 'Tim', due: '2026-04-30', done: false },
      { text: 'c', owner: 'Tim', due: '2026-04-29', done: false },
    ];
    const html = renderTodos(items, NOW);
    expect(html).toContain('todos__due--today');
    expect(html).toContain('todos__due--overdue');
  });

  it('marks done items', () => {
    const html = renderTodos([{ text: 'x', owner: 'Tim', due: '2026-04-30', done: true }], NOW);
    expect(html).toContain('todos__check--done');
    expect(html).toContain('todos__text--done');
  });

  it('shows empty state', () => {
    expect(renderTodos([], NOW)).toContain('Nothing on the list');
  });

  it('renders add / edit / delete buttons', () => {
    const html = renderTodos(getMockTodos(), NOW);
    expect(html).toContain('data-action="add"');
    expect(html).toContain('data-action="edit"');
    expect(html).toContain('data-action="delete"');
  });

  it('escapes HTML', () => {
    const html = renderTodos([{ text: '<b>x</b>', owner: 'X', due: '2026-04-30', done: false }], NOW);
    expect(html).not.toContain('<b>x</b>');
  });
});

describe('mountTodos', () => {
  it('toggles done on click', () => {
    const slot = document.createElement('div');
    mountTodos(slot, [{ text: 'x', owner: 'Tim', due: '2026-04-30', done: false }]);
    expect(slot.querySelector('.todos__check--done')).toBeNull();
    slot.querySelector('[data-action="toggle"]').click();
    expect(slot.querySelector('.todos__check--done')).not.toBeNull();
  });
});

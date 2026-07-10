import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderTodos, mountTodos } from './todos.js';
import { getMockTodos } from '../lib/todos-mock.js';
import { _resetToasts } from './toast.js';

const NOW = new Date('2026-04-30T08:00:00');

describe('renderTodos', () => {
  it('renders one row per todo with assignee', () => {
    const todos = getMockTodos();
    const html = renderTodos(todos, 99, NOW);
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
    const html = renderTodos(items, 99, NOW);
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
    const html = renderTodos(items, 99, NOW);
    expect(html).toContain('todos__due--today');
    expect(html).toContain('todos__due--overdue');
  });

  it('marks done items', () => {
    const html = renderTodos([{ text: 'x', owner: 'Tim', due: '2026-04-30', done: true }], 99, NOW);
    expect(html).toContain('todos__check--done');
    expect(html).toContain('todos__text--done');
  });

  it('shows empty state', () => {
    expect(renderTodos([], 99, NOW)).toContain('Nothing on the list');
  });

  it('renders add / edit / delete buttons', () => {
    const html = renderTodos(getMockTodos(), 99, NOW);
    expect(html).toContain('data-action="add"');
    expect(html).toContain('data-action="edit"');
    expect(html).toContain('data-action="delete"');
  });

  it('escapes HTML', () => {
    const html = renderTodos([{ text: '<b>x</b>', owner: 'X', due: '2026-04-30', done: false }], 99, NOW);
    expect(html).not.toContain('<b>x</b>');
  });
});

describe('mountTodos', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    _resetToasts();
    vi.useRealTimers();
  });

  const type = (field, value) => {
    field.value = value;
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  };

  it('toggles done on click', () => {
    const slot = document.createElement('div');
    mountTodos(slot, [{ text: 'x', owner: 'Tim', due: '2026-04-30', done: false }]);
    expect(slot.querySelector('.todos__check--done')).toBeNull();
    slot.querySelector('[data-action="toggle"]').click();
    expect(slot.querySelector('.todos__check--done')).not.toBeNull();
  });

  it('unchecks a completed live item and persists the reversal', () => {
    const slot = document.createElement('div');
    const setDone = vi.fn(() => Promise.resolve());
    mountTodos(slot, [{ id: 'a', text: 'x', done: true }], {
      append: vi.fn(), strike: vi.fn(), move: vi.fn(), setDone,
    });
    slot.querySelector('[data-action="toggle"]').click();
    expect(slot.querySelector('.todos__check--done')).toBeNull();
    expect(setDone).toHaveBeenCalledWith('a', false);
  });

  it('adds via the inline input — no window.prompt', () => {
    const slot = document.createElement('div');
    const append = vi.fn(() => Promise.resolve());
    mountTodos(slot, [{ id: 'a', text: 'existing', done: false }], { append, strike: vi.fn(), move: vi.fn() });
    slot.querySelector('[data-action="add"]').click();
    const field = slot.querySelector('.list-input__field');
    expect(field).not.toBeNull();
    type(field, 'new thing');
    expect(append).toHaveBeenCalledWith('new thing');
    const texts = [...slot.querySelectorAll('.todos__text')].map(e => e.textContent.trim());
    expect(texts[0]).toBe('new thing'); // optimistic top-insert (Google Tasks order)
    // composer stays open for rapid multi-add
    expect(slot.querySelector('.list-input__field')).not.toBeNull();
  });

  it('reverts an optimistic add when the backend rejects it', async () => {
    const slot = document.createElement('div');
    const append = vi.fn(() => Promise.reject(new Error('nope')));
    mountTodos(slot, [], { append, strike: vi.fn(), move: vi.fn() });
    slot.querySelector('[data-action="add"]').click();
    type(slot.querySelector('.list-input__field'), 'doomed');
    expect(slot.innerHTML).toContain('doomed');
    await vi.runAllTimersAsync();
    expect([...slot.querySelectorAll('.todos__text')].map(e => e.textContent)).not.toContain('doomed');
  });

  it('delete is undoable and only strikes after the toast expires', async () => {
    const slot = document.createElement('div');
    const strike = vi.fn(() => Promise.resolve());
    mountTodos(slot, [{ id: 'a', text: 'keep me', done: false }], { append: vi.fn(), strike, move: vi.fn() });

    // delete → row gone, but no API call yet
    slot.querySelector('[data-action="delete"]').click();
    expect(slot.querySelectorAll('.todos__item')).toHaveLength(0);
    expect(strike).not.toHaveBeenCalled();

    // undo → row back, API never called
    document.querySelector('.toast__action').click();
    expect(slot.querySelectorAll('.todos__item')).toHaveLength(1);
    vi.advanceTimersByTime(10_000);
    expect(strike).not.toHaveBeenCalled();

    // delete again, let the toast expire → strike commits with id + text
    slot.querySelector('[data-action="delete"]').click();
    await vi.advanceTimersByTimeAsync(5001);
    expect(strike).toHaveBeenCalledWith({ id: 'a', text: 'keep me' });
  });

  it('restores the row when a committed strike fails', async () => {
    const slot = document.createElement('div');
    const strike = vi.fn(() => Promise.reject(new Error('502')));
    mountTodos(slot, [{ id: 'a', text: 'flaky', done: false }], { append: vi.fn(), strike, move: vi.fn() });
    slot.querySelector('[data-action="toggle"]').click();
    expect(slot.querySelector('.todos__check--done')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(5001);
    await vi.runAllTimersAsync();
    expect(slot.querySelector('.todos__check--done')).toBeNull();
  });

  it('edits inline and persists through actions.update', () => {
    const slot = document.createElement('div');
    const update = vi.fn(() => Promise.resolve());
    mountTodos(slot, [{ id: 'a', text: 'old text', done: false }], { append: vi.fn(), strike: vi.fn(), move: vi.fn(), update });
    slot.querySelector('[data-action="edit"]').click();
    const field = slot.querySelector('.list-input__field');
    expect(field.value).toBe('old text');
    type(field, 'new text');
    expect(update).toHaveBeenCalledWith('a', 'new text');
    expect(slot.querySelector('.todos__text').textContent.trim()).toBe('new text');
  });

  it('Escape closes the composer without adding', () => {
    const slot = document.createElement('div');
    mountTodos(slot, []);
    slot.querySelector('[data-action="add"]').click();
    const field = slot.querySelector('.list-input__field');
    field.value = 'abandoned';
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(slot.querySelector('.list-input__field')).toBeNull();
    expect(slot.innerHTML).not.toContain('abandoned');
  });
});

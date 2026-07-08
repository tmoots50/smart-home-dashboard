import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showToast, _resetToasts } from './toast.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  _resetToasts();
  vi.useRealTimers();
});

describe('showToast', () => {
  it('renders the message and action label', () => {
    showToast('Deleted "milk"', { actionLabel: 'Undo' });
    expect(document.querySelector('.toast__msg').textContent).toBe('Deleted "milk"');
    expect(document.querySelector('.toast__action').textContent).toBe('Undo');
  });

  it('fires onAction (not onExpire) when the action is tapped', () => {
    const onAction = vi.fn();
    const onExpire = vi.fn();
    showToast('x', { actionLabel: 'Undo', onAction, onExpire });
    document.querySelector('.toast__action').click();
    expect(onAction).toHaveBeenCalledOnce();
    expect(onExpire).not.toHaveBeenCalled();
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('fires onExpire when the duration elapses', () => {
    const onAction = vi.fn();
    const onExpire = vi.fn();
    showToast('x', { actionLabel: 'Undo', onAction, onExpire, duration: 5000 });
    vi.advanceTimersByTime(5001);
    expect(onExpire).toHaveBeenCalledOnce();
    expect(onAction).not.toHaveBeenCalled();
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('settles the previous toast as expired when replaced — commits are never lost', () => {
    const first = vi.fn();
    showToast('first', { onExpire: first });
    showToast('second', {});
    expect(first).toHaveBeenCalledOnce();
    expect(document.querySelectorAll('.toast')).toHaveLength(1);
    expect(document.querySelector('.toast__msg').textContent).toBe('second');
  });
});

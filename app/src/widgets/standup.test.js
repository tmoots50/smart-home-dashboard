import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { renderStandup, mountStandup } from './standup.js';
import { getMockStandup } from '../lib/standup-mock.js';

describe('renderStandup', () => {
  it('renders explicit grouped attribution and overflow counts', () => {
    const html = renderStandup(getMockStandup());

    expect(html).toContain('Grouped by route:ops');
    expect(html).not.toContain('≈ grouped');
    expect(html).toContain('aria-label="2 more grouped items"');
    expect(html).toContain('>+2</span>');
  });

  it('renders clear blockers honestly', () => {
    const html = renderStandup(getMockStandup());

    expect(html.match(/standup-cell--clear/g)).toHaveLength(3);
    expect(html).toContain('Nigel · Blockers · Clear · No blockers');
  });

  it('keeps last-known rows visible with an explicit stale notice', () => {
    const html = renderStandup({
      ...getMockStandup(),
      state: 'stale',
      freshness: 'Linear · stale since 8:42 AM',
      message: 'Live Linear is unavailable; showing last-known data.',
    });

    expect(html).toContain('Live Linear is unavailable; showing last-known data.');
    expect(html).toContain('data-agent="Nigel"');
    expect(html).toContain('Linear · stale since 8:42 AM');
  });

  it('shows grouped unresolved records without assigning them to an agent', () => {
    const html = renderStandup({
      ...getMockStandup(),
      unresolved: [{ basis: 'project:Smart Home Dashboard', count: 2 }],
    });

    expect(html).toContain('2 unassigned records');
    expect(html).toContain('Grouped by project:Smart Home Dashboard');
  });

  it('states both cell and upstream truncation instead of silently omitting work', () => {
    const html = renderStandup({
      ...getMockStandup(),
      truncated: 3,
      sourceTruncated: true,
    });

    expect(html).toContain('3 additional cell entries omitted');
    expect(html).toContain('latest 100 issues');
  });

  it('renders an unavailable response with its honest server message', () => {
    const html = renderStandup({
      state: 'unavailable',
      freshness: 'Linear · unavailable',
      message: 'Linear standup is not configured.',
      agents: [],
    });

    expect(html).toContain('Linear standup is not configured.');
    expect(html).not.toContain('data-agent=');
  });
});

describe('mountStandup', () => {
  beforeEach(() => {
    document.documentElement.className = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.className = '';
  });

  it('opens an in-context detail overlay for a grouped cell', () => {
    const slot = document.createElement('section');
    document.body.appendChild(slot);
    mountStandup(slot, { initial: getMockStandup(), live: Promise.resolve(null) });

    slot.querySelector('[data-agent="Smith"][data-column="yesterday"]').click();

    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    expect(document.querySelector('[data-detail-key]').textContent).toBe('Smith · yesterday');
    expect(document.querySelector('.standup-detail__items').textContent).toContain('PRO-118');
  });

  it('closes the detail through the visible control, scrim, and Escape', () => {
    const slot = document.createElement('section');
    document.body.appendChild(slot);
    mountStandup(slot, { initial: getMockStandup(), live: Promise.resolve(null) });
    const cell = slot.querySelector('[data-agent="Derek"][data-column="blockers"]');

    cell.click();
    document.querySelector('[data-standup-close]').click();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.documentElement.classList.contains('has-overlay')).toBe(false);

    cell.click();
    document.querySelector('[data-standup-overlay]').click();
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    cell.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.documentElement.classList.contains('has-overlay')).toBe(false);
  });

  it('renders an explicit unavailable state when an unexpected live source rejects', async () => {
    const slot = document.createElement('section');
    document.body.appendChild(slot);
    mountStandup(slot, {
      initial: {
        state: 'loading',
        freshness: 'Linear · loading',
        message: 'Loading Linear standup…',
        agents: [],
      },
      live: Promise.reject(new Error('feed failed')),
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(slot.textContent).toContain('Linear standup is temporarily unavailable.');
    expect(slot.querySelectorAll('.agent-row')).toHaveLength(0);
  });
});

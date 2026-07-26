import { describe, it, expect } from 'vitest';
import { renderDaybrief, isVisible } from './daybrief.js';

const MORNING = new Date('2026-07-27T08:15:00');

const brief = (over = {}) => ({
  date: '2026-07-27',
  generatedAt: '2026-07-27T11:30:00.000Z',
  headline: 'Clear morning, stacked afternoon.',
  bodyTitle: '🗞️ Headlines',
  body: ['🏫 **The week’s story is childcare.** Settle who has Mabel.'],
  sections: [
    { kind: 'today', title: '🗓️ Today', items: [{ time: 'Morning', text: 'Clear until noon' }] },
    { kind: 'comingup', title: '🔭 Coming up', items: [{ time: 'Tue', text: 'Checkup, 1:00' }] },
  ],
  closer: '94 today, 99 tomorrow.',
  ...over,
});

describe('renderDaybrief', () => {
  it('letter flavor renders Headlines prose + section rail', () => {
    const html = renderDaybrief(brief(), { flavor: 'letter' });
    expect(html).toContain('🗞️ Headlines');
    expect(html).toContain('<strong>The week’s story is childcare.</strong>');
    expect(html).toContain('daybrief__rail');
    expect(html).toContain('🗓️ Today');
  });

  it('letter flavor falls back to columns when the payload has no body', () => {
    const html = renderDaybrief(brief({ body: [] }), { flavor: 'letter' });
    expect(html).toContain('daybrief__cols');
    expect(html).not.toContain('daybrief__letter');
  });

  it('split falls back to a flow when every section lands on one side', () => {
    const oneSided = brief({ sections: [
      { kind: 'today', title: 'Today', items: [{ text: 'x' }] },
      { kind: 'todos', title: 'Worth doing', items: [{ text: 'y' }] },
    ] });
    const html = renderDaybrief(oneSided, { flavor: 'split' });
    expect(html).toContain('daybrief__cols');
    expect(html).not.toContain('daybrief__split');
  });

  it('agenda renders the today section as a timeline', () => {
    const html = renderDaybrief(brief(), { flavor: 'agenda' });
    expect(html).toContain('daybrief__timeline');
    expect(html).toContain('daybrief__tl-time');
  });

  it('supports **bold** but escapes all other markup', () => {
    const html = renderDaybrief(brief({
      body: ['**bold** stays, <script>alert(1)</script> does not'],
      closer: 'a **bold** closer',
    }), { flavor: 'letter' });
    expect(html).toContain('<strong>bold</strong>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a <strong>bold</strong> closer');
  });

  it('sanitizes unknown section kinds into the class name', () => {
    const html = renderDaybrief(brief({
      body: [],
      sections: [{ kind: 'x" onmouseover="', title: 'Evil', items: [{ text: 'hi' }] }],
    }));
    expect(html).toContain('daybrief__section--note');
    expect(html).not.toContain('onmouseover');
  });

  it('omits headline, closer, and empty sections when absent', () => {
    const html = renderDaybrief(brief({
      headline: '', closer: null,
      sections: [{ kind: 'today', title: 'Today', items: [] }],
    }), { flavor: 'columns' });
    expect(html).not.toContain('daybrief__headline');
    expect(html).not.toContain('daybrief__closer');
    expect(html).not.toContain('daybrief__section--today');
  });
});

describe('isVisible', () => {
  it('shows a same-day brief in the morning when not dismissed', () => {
    expect(isVisible(brief(), MORNING, null)).toBe(true);
  });

  it('hides a brief for a different day (yesterday never lingers)', () => {
    expect(isVisible(brief({ date: '2026-07-26' }), MORNING, null)).toBe(false);
  });

  it('hides after the noon cutoff', () => {
    expect(isVisible(brief(), new Date('2026-07-27T12:00:00'), null)).toBe(false);
    expect(isVisible(brief(), new Date('2026-07-27T11:59:00'), null)).toBe(true);
  });

  it('hides the cleared generation only — a re-publish supersedes the clear', () => {
    const first = brief();
    expect(isVisible(first, MORNING, first.generatedAt)).toBe(false);
    // Hermes re-publishes later the same day → new generatedAt → visible again.
    const republished = brief({ generatedAt: '2026-07-27T12:05:00.000Z' });
    expect(isVisible(republished, MORNING, first.generatedAt)).toBe(true);
    // Yesterday's clear marker never hides today's brief.
    expect(isVisible(brief(), MORNING, '2026-07-26T11:00:00.000Z')).toBe(true);
  });

  it('falls back to date-keyed dismissal for blobs without generatedAt', () => {
    const legacy = brief({ generatedAt: undefined });
    expect(isVisible(legacy, MORNING, '2026-07-27')).toBe(false);
  });

  it('hides null blobs and content-free briefs', () => {
    expect(isVisible(null, MORNING, null)).toBe(false);
    expect(isVisible(brief({ headline: '', body: [], sections: [] }), MORNING, null)).toBe(false);
  });
});

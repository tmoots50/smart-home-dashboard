import { describe, it, expect } from 'vitest';
import { renderCountdown } from './countdown.js';

// Wednesday: this week runs through Sat Jul 18; left pane = Sun Jul 19 → Aug 16.
const NOW = new Date('2026-07-15T07:30:00');

const ev = (over) => ({
  id: over.id ?? `${over.title}|${over.startsAt}`,
  calendar: 'Family', title: 'Event', sub: '', allDay: false, ...over,
});

// Occupy the calendar card's six per-person slots so the events under test
// actually reach the left pane (the card-dupe rule would swallow them in a
// sparse feed). Near-term, so the left window never shows them either.
const cardFillers = () => Array.from({ length: 6 }, (_, i) =>
  ev({ id: `fill-${i}`, title: `Card filler ${i}`, startsAt: `2026-07-15T${String(8 + i).padStart(2, '0')}:00:00` }));

describe('renderCountdown (two panes)', () => {
  it('places agenda items left and planning items right', () => {
    const html = renderCountdown([
      ...cardFillers(),
      ev({ title: "Aidan's 3rd Birthday", startsAt: '2026-07-20T15:30:00' }),
      ev({ title: 'Flight to NYC', startsAt: '2026-09-01T08:00:00' }),
    ], NOW);
    const [left, right] = html.split('Plan ahead');
    expect(left).toContain('Aidan');
    expect(right).toContain('Flight to NYC');
  });

  it('excludes this-week items from the left pane entirely', () => {
    const html = renderCountdown([ev({ title: 'This week thing', startsAt: '2026-07-17T10:00:00' })], NOW);
    expect(html).not.toContain('This week thing');
  });

  it('omits location details and reminder notes (Tim 2026-07-11: no locations here)', () => {
    const html = renderCountdown(
      [...cardFillers(), { name: 'Mom’s birthday', date: '2026-07-21', sub: 'La Belle Buckhead 3535 Peachtree Rd NE', note: 'Get a card this week' }],
      NOW,
    );
    expect(html).toContain('Mom’s birthday');
    // Location and legacy notes stay available in the row's data-event
    // payload (the detail modal uses it) but must not render as row text.
    expect(html).not.toContain('countdown__sub');
    expect(html).not.toContain('countdown__note');
    const visible = html.replace(/data-event="[^"]*"/g, '');
    expect(visible).not.toContain('Peachtree');
    expect(visible).not.toContain('Get a card this week');
  });

  it('applies Hermes overrides: hide + score reorder', () => {
    const items = [
      ...cardFillers(),
      ev({ title: 'Water Hanging Planters', startsAt: '2026-07-20T20:00:00' }),
      ev({ title: 'Flight to NYC', startsAt: '2026-09-01T08:00:00' }),
      ev({ title: 'Narvar offsite', startsAt: '2026-08-20T09:00:00' }),
    ];
    const html = renderCountdown(items, NOW, new Set(), new Set(), [
      { match: 'water hanging', hide: true },
      { match: 'Narvar offsite', score: 999 },
    ]);
    expect(html).not.toContain('Water Hanging Planters');
    expect(html.indexOf('Narvar offsite')).toBeLessThan(html.indexOf('Flight to NYC'));
  });

  it('color-codes categories on the row', () => {
    const html = renderCountdown([
      ...cardFillers(),
      ev({ title: "Aidan's 3rd Birthday", startsAt: '2026-07-20T15:30:00' }),
      ev({ title: 'Give Chloe heartworm pill', startsAt: '2026-07-21T08:00:00', recurring: true }),
      ev({ title: '4 month check up', sub: 'Lighthouse Pediatrics', startsAt: '2026-07-22T09:00:00' }),
      ev({ title: 'Flight to NYC', startsAt: '2026-09-01T08:00:00' }),
    ], NOW);
    for (const cat of ['birthday', 'recurring', 'mabel', 'travel']) {
      expect(html).toContain(`countdown__item--${cat}`);
    }
  });

  it('formats today / tomorrow on imminent planning items and N days on the agenda', () => {
    const html = renderCountdown([
      ...cardFillers(),
      ev({ title: 'Flight out', startsAt: '2026-07-15T18:00:00' }),
      ev({ title: 'Flight back', startsAt: '2026-07-16T18:00:00' }),
      ev({ title: 'Lunch with Sarah', startsAt: '2026-07-20T12:00:00' }),
    ], NOW);
    expect(html).toContain('today');
    expect(html).toContain('tomorrow');
    expect(html).toMatch(/\d+ days/);
  });

  it('renders the absolute date with weekday + ordinal', () => {
    const html = renderCountdown([...cardFillers(), ev({ title: 'X', startsAt: '2026-07-21T10:00:00' })], NOW);
    expect(html).toMatch(/Tue, Jul 21st/);
  });

  it('shows per-pane empty states with no events', () => {
    const html = renderCountdown([], NOW);
    expect(html).toContain('Nothing on the horizon');
    expect(html).toContain('Nothing needs planning');
  });

  it('escapes HTML in names', () => {
    const html = renderCountdown([...cardFillers(), ev({ title: '<x>', startsAt: '2026-07-21T10:00:00' })], NOW);
    expect(html).not.toContain('<x>');
  });

  it('hides dismissed items and marks completing items done', () => {
    const items = [
      ...cardFillers(),
      ev({ id: 'a', title: 'A', startsAt: '2026-07-20T10:00:00' }),
      ev({ id: 'b', title: 'B', startsAt: '2026-07-21T10:00:00' }),
      ev({ id: 'c', title: 'C', startsAt: '2026-07-22T10:00:00' }),
    ];
    const html = renderCountdown(items, NOW, new Set(['b']), new Set(['a']));
    expect(html).not.toContain('>B<');
    expect((html.match(/countdown__item--done/g) || []).length).toBe(1);
  });
});

import { describe, it, expect } from 'vitest';
import { dinnerLabel, isDinnerEvent, dinnersByDay, ymdLocal } from './meals.js';

const allDay = (startsAt, title, extra = {}) => ({
  id: `${startsAt}-${title}`, title, startsAt, endsAt: startsAt, allDay: true, ...extra,
});

describe('dinnerLabel', () => {
  it('parses the "Dinner: X" convention, case-insensitive, any dash or colon', () => {
    expect(dinnerLabel('Dinner: Enchiladas')).toBe('Enchiladas');
    expect(dinnerLabel('dinner - burgers')).toBe('burgers');
    expect(dinnerLabel('Dinner — Breakfast burritos')).toBe('Breakfast burritos');
    expect(dinnerLabel('  Dinner:  Tacos al pastor  ')).toBe('Tacos al pastor');
  });

  it('requires the separator — a dinner OUTING is not a meal plan', () => {
    expect(dinnerLabel('Dinner at the Petersons')).toBeNull();
    expect(dinnerLabel('Dinner')).toBeNull();
    expect(dinnerLabel('Family dinner: fancy')).toBeNull(); // prefix must lead
    expect(dinnerLabel('')).toBeNull();
    expect(dinnerLabel(undefined)).toBeNull();
  });
});

describe('isDinnerEvent', () => {
  it('needs BOTH the all-day flag and the title convention', () => {
    expect(isDinnerEvent(allDay('2026-08-02', 'Dinner: Enchiladas'))).toBe(true);
    expect(isDinnerEvent({ title: 'Dinner: Enchiladas', startsAt: '2026-08-02T18:00:00', allDay: false })).toBe(false);
    expect(isDinnerEvent(allDay('2026-08-02', 'Dinner with Mom'))).toBe(false);
    expect(isDinnerEvent(null)).toBe(false);
  });
});

describe('dinnersByDay', () => {
  it('maps each day to its meal with the prefix stripped', () => {
    const map = dinnersByDay([
      allDay('2026-08-02', 'Dinner: Enchiladas'),
      allDay('2026-08-03', 'Dinner: Burgers'),
      allDay('2026-08-03', 'Grandma visiting'), // non-dinner all-day ignored
    ]);
    expect(map.get('2026-08-02')?.label).toBe('Enchiladas');
    expect(map.get('2026-08-03')?.label).toBe('Burgers');
    expect(map.size).toBe(2);
  });

  it('keeps the original event so a tap can open event detail', () => {
    const ev = allDay('2026-08-02', 'Dinner: Enchiladas');
    expect(dinnersByDay([ev]).get('2026-08-02')?.event).toBe(ev);
  });

  it('double-booked day: first by (startsAt, title) wins deterministically', () => {
    const map = dinnersByDay([
      allDay('2026-08-02', 'Dinner: Ziti'),
      allDay('2026-08-02', 'Dinner: Enchiladas'),
    ]);
    expect(map.get('2026-08-02')?.label).toBe('Enchiladas');
  });
});

describe('ymdLocal', () => {
  it('formats local dates as YYYY-MM-DD with zero padding', () => {
    expect(ymdLocal(new Date(2026, 7, 2))).toBe('2026-08-02');
    expect(ymdLocal(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
});

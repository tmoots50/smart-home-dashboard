import { describe, it, expect } from 'vitest';
import { renderEventDetail, openEventDetail } from './event-detail.js';

const BASE = {
  id: 'e1',
  title: 'Dentist',
  startsAt: '2026-07-10T14:00:00-04:00',
  endsAt:   '2026-07-10T15:00:00-04:00',
  sub: 'Midtown Dental',
  description: 'Bring insurance card.',
  calendar: 'Tim',
  allDay: false,
};

describe('renderEventDetail', () => {
  it('renders title, location, description, and calendar chip', () => {
    const html = renderEventDetail(BASE);
    expect(html).toContain('Dentist');
    expect(html).toContain('Midtown Dental');
    expect(html).toContain('Bring insurance card.');
    expect(html).toContain('cal-chip--tim');
    expect(html).toContain('Tim');
  });

  it('omits location row when sub is empty', () => {
    const html = renderEventDetail({ ...BASE, sub: '' });
    expect(html).not.toContain('PIN_SVG');
    // no location icon row rendered
    const pinCount = (html.match(/event-detail__row/g) || []).length;
    const withSub = (renderEventDetail(BASE).match(/event-detail__row/g) || []).length;
    expect(pinCount).toBeLessThan(withSub);
  });

  it('omits description row when description is empty', () => {
    const html = renderEventDetail({ ...BASE, description: '' });
    expect(html).not.toContain('event-detail__description');
  });

  it('escapes HTML in title and description', () => {
    const html = renderEventDetail({ ...BASE, title: '<img onerror=1>', description: '<script>bad</script>' });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;img');
  });

  it('shows All day label for all-day events', () => {
    const html = renderEventDetail({ ...BASE, allDay: true, startsAt: '2026-07-10' });
    expect(html).toContain('All day');
  });

  it('omits calendar row when calendar is empty', () => {
    const html = renderEventDetail({ ...BASE, calendar: '' });
    expect(html).not.toContain('cal-chip');
  });
});

describe('openEventDetail', () => {
  it('mounts panel and closes on ✕', () => {
    const close = openEventDetail(BASE);
    expect(document.querySelector('.overlay--event-detail')).not.toBeNull();
    expect(document.querySelector('.event-detail')).not.toBeNull();
    document.querySelector('[data-action="close"]').click();
    expect(document.querySelector('.overlay--event-detail')).toBeNull();
    close(); // idempotent
  });

  it('closes on Escape', () => {
    openEventDetail(BASE);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.overlay--event-detail')).toBeNull();
  });

  it('closes on scrim click', () => {
    openEventDetail(BASE);
    const host = document.querySelector('.overlay--event-detail');
    host.click();
    expect(document.querySelector('.overlay--event-detail')).toBeNull();
  });
});

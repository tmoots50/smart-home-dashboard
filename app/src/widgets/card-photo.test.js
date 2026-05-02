import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderCardPhoto, mountCardPhoto } from './card-photo.js';
import { getMockPhotos } from '../lib/photos-mock.js';

describe('renderCardPhoto', () => {
  it('renders one img per photo and marks the current one', () => {
    const photos = getMockPhotos();
    const html = renderCardPhoto(photos, 1);
    const matches = html.match(/<img/g) || [];
    expect(matches.length).toBe(photos.length);
    expect(html).toContain('is-current');
  });

  it('renders the current caption', () => {
    const photos = getMockPhotos();
    const html = renderCardPhoto(photos, 2);
    expect(html).toContain(photos[2].caption);
  });

  it('returns empty string for empty list', () => {
    expect(renderCardPhoto([])).toBe('');
  });
});

describe('mountCardPhoto', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('advances to the next photo on interval', () => {
    const slot = document.createElement('div');
    const photos = getMockPhotos();
    mountCardPhoto(slot, photos, { intervalMs: 1000 });

    const start = slot.querySelector('.card__photo-caption').textContent;
    vi.advanceTimersByTime(1000);
    const next = slot.querySelector('.card__photo-caption').textContent;

    expect(next).not.toBe(start);
  });
});

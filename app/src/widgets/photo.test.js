import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderPhoto, mountPhoto } from './photo.js';
import { getMockPhotos } from '../lib/photos-mock.js';

describe('renderPhoto', () => {
  const photos = getMockPhotos();

  it('renders one img per photo and marks the current one', () => {
    const html = renderPhoto(photos, 1);
    const matches = html.match(/photo__img/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(photos.length);
    expect(html).toContain('photo__img--current');
  });

  it('renders the current caption', () => {
    const html = renderPhoto(photos, 2);
    expect(html).toContain(photos[2].caption);
  });

  it('handles empty photo list without crashing', () => {
    expect(() => renderPhoto([])).not.toThrow();
  });
});

describe('mountPhoto', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('advances to the next photo on interval', () => {
    const slot = document.createElement('div');
    const photos = getMockPhotos();
    mountPhoto(slot, photos, { intervalMs: 1000 });

    const startCaption = slot.querySelector('.photo__caption').textContent;
    vi.advanceTimersByTime(1000);
    const nextCaption = slot.querySelector('.photo__caption').textContent;

    expect(nextCaption).not.toBe(startCaption);
  });
});

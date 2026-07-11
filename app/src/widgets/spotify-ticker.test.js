import { describe, expect, it } from 'vitest';
import { renderSpotifyTicker } from './spotify-ticker.js';
import { playing, paused, inactive, overflow } from '../lib/spotify-mock.js';

describe('renderSpotifyTicker', () => {
  it('renders playing metadata, progress, and pause control', () => {
    const html = renderSpotifyTicker(playing);
    expect(html).toContain('Golden');
    expect(html).toContain('aria-label="Pause"');
    expect(html).toContain('spotify-ticker__progress');
  });
  it('switches to a play control while paused and hides when inactive', () => {
    expect(renderSpotifyTicker(paused)).toContain('aria-label="Play"');
    expect(renderSpotifyTicker(inactive)).toBe('');
  });
  it('escapes untrusted metadata', () => {
    expect(renderSpotifyTicker({ ...overflow, track: { ...overflow.track, title: '<img onerror=alert(1)>' } })).not.toContain('<img onerror');
  });
});


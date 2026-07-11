import { describe, expect, it, vi } from 'vitest';
import { getPlayer, openSpotifyPlayer, spotifyWebUrl } from './spotify.js';

describe('spotify client', () => {
  it('targets the Spotify web player for the documented fallback', () => {
    const navigate = vi.fn();
    openSpotifyPlayer(navigate);
    expect(navigate).toHaveBeenCalledWith(spotifyWebUrl);
  });
  it('provides an active mock player without env configuration', () => {
    expect(getPlayer().initial).toMatchObject({ active: true, track: { title: expect.any(String), artist: expect.any(String) } });
  });
});


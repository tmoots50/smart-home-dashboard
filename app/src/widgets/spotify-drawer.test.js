import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openSpotifyDrawer, renderSpotifyDrawer } from './spotify-drawer.js';
import { states } from './spotify-drawer.fixtures.js';

describe('renderSpotifyDrawer', () => {
  beforeEach(() => { document.body.innerHTML = ''; document.documentElement.classList.remove('has-overlay'); });
  it('renders a playlist grid and the shared now-playing surface', () => {
    const html = renderSpotifyDrawer(states.playlists);
    expect(html).toContain('Slow Sunday');
    expect(html).toContain('spotify-now');
    expect(html).toContain('Playing here');
  });
  it('renders search and add-to-playlist states', () => {
    expect(renderSpotifyDrawer(states.search)).toContain('Lovely Day');
    expect(renderSpotifyDrawer(states['add-to-playlist'])).toContain('Add <strong>Lovely Day</strong>');
  });
  it('renders a useful DRM fallback', () => {
    expect(renderSpotifyDrawer(states['sdk-unavailable'])).toContain("Dashboard audio isn't available");
  });

  it('loads playlists and starts one without leaving the page', async () => {
    const spotify = {
      isConfigured: false,
      getPlayer: () => ({ initial: states.playlists.player, live: Promise.resolve(states.playlists.player) }),
      fetchPlayer: vi.fn().mockResolvedValue(states.playlists.player),
      getPlaylists: vi.fn().mockResolvedValue({ items: states.playlists.playlists }),
      play: vi.fn().mockResolvedValue({ ok: true }),
      controls: { play: vi.fn(), pause: vi.fn(), next: vi.fn(), previous: vi.fn() },
    };
    openSpotifyDrawer(spotify);
    await Promise.resolve(); await Promise.resolve();
    document.querySelector('[data-spotify-drawer-action="play-playlist"]').click();
    await Promise.resolve();
    expect(spotify.play).toHaveBeenCalledWith({ deviceId: undefined, contextUri: 'spotify:playlist:slow-sunday' });
    expect(document.querySelector('.spotify-overlay')).toBeTruthy();
  });
});

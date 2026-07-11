import { describe, expect, it } from 'vitest';
import { normalizePlayer } from './spotify-api.js';

describe('normalizePlayer', () => {
  it('normalizes tracks and chooses the smallest art at least 128px wide', () => {
    const result = normalizePlayer({
      is_playing: true, progress_ms: 1234, repeat_state: 'context', shuffle_state: true,
      device: { id: 'd1', name: 'Kitchen', type: 'Speaker', volume_percent: 42 },
      item: { type: 'track', name: 'Golden', uri: 'spotify:track:1', duration_ms: 5000,
        artists: [{ name: 'Jill Scott' }], album: { name: 'Album', images: [
          { url: 'large', width: 640 }, { url: 'tiny', width: 64 }, { url: 'right', width: 128 },
        ] } },
    });
    expect(result.active).toBe(true);
    expect(result.track).toMatchObject({ title: 'Golden', artist: 'Jill Scott', artUrl: 'right' });
    expect(result.device.volume).toBe(42);
  });

  it('treats a missing item as inactive', () => {
    expect(normalizePlayer({ is_playing: false, item: null })).toEqual({ active: false });
  });

  it('maps episodes to their show and publisher', () => {
    const result = normalizePlayer({ item: { type: 'episode', name: 'A good episode', duration_ms: 10,
      show: { name: 'The Daily', publisher: 'NYT' }, images: [{ url: 'episode-art', width: 300 }] } });
    expect(result).toMatchObject({ type: 'episode', track: { artist: 'The Daily', album: 'NYT', artUrl: 'episode-art' } });
  });
});


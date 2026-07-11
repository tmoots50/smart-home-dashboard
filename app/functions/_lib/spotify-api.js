import { getAccessToken } from './spotify-auth.js';

const API = 'https://api.spotify.com/v1';

export class SpotifyApiError extends Error {
  constructor(status, message, body = null) {
    super(message);
    this.name = 'SpotifyApiError';
    this.status = status;
    this.body = body;
  }
}

async function spotifyFetch(env, path, init = {}) {
  const token = await getAccessToken(env);
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let detail = text;
    try { detail = JSON.parse(text); } catch {}
    throw new SpotifyApiError(response.status, detail?.error?.message || `Spotify API ${response.status}`, detail);
  }
  return response;
}

function smallestUsefulArt(images = []) {
  const usable = images.filter(image => image?.url && (!image.width || image.width >= 128));
  return [...(usable.length ? usable : images)].sort((a, b) => (a.width || Infinity) - (b.width || Infinity))[0]?.url ?? null;
}

export function normalizePlayer(player) {
  if (!player?.item) return { active: false };
  const item = player.item;
  const isEpisode = item.type === 'episode';
  return {
    active: true,
    isPlaying: Boolean(player.is_playing),
    type: isEpisode ? 'episode' : 'track',
    track: {
      title: item.name || 'Untitled',
      artist: isEpisode ? (item.show?.name || 'Podcast') : (item.artists || []).map(artist => artist.name).join(', '),
      album: isEpisode ? (item.show?.publisher || '') : (item.album?.name || ''),
      artUrl: smallestUsefulArt(isEpisode ? item.images : item.album?.images),
      uri: item.uri || null,
    },
    progressMs: Math.max(0, player.progress_ms || 0),
    durationMs: Math.max(0, item.duration_ms || 0),
    fetchedAt: Date.now(),
    device: player.device ? {
      id: player.device.id || null,
      name: player.device.name || 'Spotify device',
      type: player.device.type || 'Unknown',
      volume: player.device.volume_percent ?? null,
    } : null,
    shuffle: Boolean(player.shuffle_state),
    repeat: player.repeat_state || 'off',
  };
}

export async function readPlayer(env) {
  const response = await spotifyFetch(env, '/me/player?additional_types=episode');
  if (response.status === 204) return { active: false };
  return normalizePlayer(await response.json());
}

export async function sendControl(env, action, payload = {}) {
  const actions = {
    play: ['PUT', '/me/player/play'],
    pause: ['PUT', '/me/player/pause'],
    next: ['POST', '/me/player/next'],
    previous: ['POST', '/me/player/previous'],
    shuffle: ['PUT', `/me/player/shuffle?state=${payload.state ? 'true' : 'false'}`],
    volume: ['PUT', `/me/player/volume?volume_percent=${Math.max(0, Math.min(100, Number(payload.volume) || 0))}`],
  };
  const config = actions[action];
  if (!config) throw new SpotifyApiError(400, 'Unsupported player action');
  await spotifyFetch(env, config[1], { method: config[0] });
  return { ok: true };
}

export async function listPlaylists(env, { limit = 24, offset = 0 } = {}) {
  const response = await spotifyFetch(env, `/me/playlists?limit=${Math.min(50, limit)}&offset=${offset}`);
  const data = await response.json();
  return {
    items: (data.items || []).filter(Boolean).map(item => ({
      id: item.id, uri: item.uri, name: item.name, owner: item.owner?.display_name || '',
      tracks: item.tracks?.total || 0, artUrl: smallestUsefulArt(item.images),
    })),
    next: Boolean(data.next),
  };
}

export async function searchTracks(env, query, { limit = 20 } = {}) {
  const response = await spotifyFetch(env, `/search?type=track&limit=${Math.min(50, limit)}&q=${encodeURIComponent(query)}`);
  const data = await response.json();
  return (data.tracks?.items || []).map(item => ({
    id: item.id, uri: item.uri, title: item.name,
    artist: (item.artists || []).map(artist => artist.name).join(', '),
    album: item.album?.name || '', artUrl: smallestUsefulArt(item.album?.images),
    durationMs: item.duration_ms || 0,
  }));
}

export async function startPlayback(env, { deviceId, contextUri, uris, offsetUri } = {}) {
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
  const body = contextUri
    ? { context_uri: contextUri, ...(offsetUri ? { offset: { uri: offsetUri } } : {}) }
    : { uris: Array.isArray(uris) ? uris.slice(0, 100) : [] };
  await spotifyFetch(env, `/me/player/play${query}`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  return { ok: true };
}

export async function queueTrack(env, uri, deviceId) {
  const query = new URLSearchParams({ uri });
  if (deviceId) query.set('device_id', deviceId);
  await spotifyFetch(env, `/me/player/queue?${query}`, { method: 'POST' });
  return { ok: true };
}

export async function addToPlaylist(env, playlistId, uris) {
  const response = await spotifyFetch(env, `/playlists/${encodeURIComponent(playlistId)}/tracks`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ uris: uris.slice(0, 100) }),
  });
  return response.json();
}

export async function transferPlayback(env, deviceId, play = false) {
  await spotifyFetch(env, '/me/player', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
  return { ok: true };
}


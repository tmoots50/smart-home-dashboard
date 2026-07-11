import * as mock from './spotify-mock.js';

const TOKEN = import.meta.env.VITE_DASHBOARD_TOKEN;
const LIVE_MODE = Boolean(TOKEN && import.meta.env.VITE_SPOTIFY_LIVE === '1');
let mockState = structuredClone(mock.playing);

export class SpotifyError extends Error {
  constructor(code, message, status = 0) { super(message); this.name = 'SpotifyError'; this.code = code; this.status = status; }
}

async function request(path, init = {}) {
  const response = await fetch(path, {
    ...init,
    headers: { authorization: `Bearer ${TOKEN}`, ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new SpotifyError(data.error || `HTTP_${response.status}`, data.error || 'Spotify request failed', response.status);
  return data;
}

export async function fetchPlayer() {
  return LIVE_MODE ? request('/api/spotify/player') : structuredClone(mockState);
}

export function getPlayer() {
  return LIVE_MODE
    ? { initial: null, live: fetchPlayer().catch(() => null) }
    : { initial: structuredClone(mockState), live: Promise.resolve(structuredClone(mockState)) };
}

async function mockControl(action, payload = {}) {
  if (!mockState.active) throw new SpotifyError('NO_ACTIVE_DEVICE', 'Nothing playing', 409);
  if (action === 'play') mockState.isPlaying = true;
  if (action === 'pause') mockState.isPlaying = false;
  if (action === 'next' || action === 'previous') mockState = { ...structuredClone(mock.playing), fetchedAt: Date.now() };
  if (action === 'shuffle') mockState.shuffle = Boolean(payload.state);
  if (action === 'volume') mockState.device.volume = Number(payload.volume);
  mockState.fetchedAt = Date.now();
  window.dispatchEvent(new CustomEvent('spotify-statechange', { detail: structuredClone(mockState) }));
  return { ok: true };
}

export const controls = {
  command(action, payload = {}) {
    return LIVE_MODE
      ? request('/api/spotify/player', { method: 'POST', body: JSON.stringify({ action, ...payload }) })
      : mockControl(action, payload);
  },
  play() { return this.command('play'); },
  pause() { return this.command('pause'); },
  next() { return this.command('next'); },
  previous() { return this.command('previous'); },
  shuffle(state) { return this.command('shuffle', { state }); },
  volume(volume) { return this.command('volume', { volume }); },
};

export async function getPlaylists() {
  return LIVE_MODE ? request('/api/spotify/playlists') : { items: structuredClone(mock.playlists), next: false };
}
export async function search(query) {
  return LIVE_MODE ? request(`/api/spotify/search?q=${encodeURIComponent(query)}`) : { items: structuredClone(mock.searchResults) };
}
export async function play({ deviceId, contextUri, uris, offsetUri }) {
  if (LIVE_MODE) return request('/api/spotify/playback', { method: 'POST', body: JSON.stringify({ deviceId, contextUri, uris, offsetUri }) });
  mockState = { ...structuredClone(mock.playing), isPlaying: true, fetchedAt: Date.now(), device: { ...mock.playing.device, id: deviceId || 'dashboard' } };
  window.dispatchEvent(new CustomEvent('spotify-statechange', { detail: structuredClone(mockState) }));
  return { ok: true };
}
export async function queue(uri, deviceId) {
  return LIVE_MODE ? request('/api/spotify/queue', { method: 'POST', body: JSON.stringify({ uri, deviceId }) }) : { ok: true };
}
export async function addToPlaylist(playlistId, uris) {
  return LIVE_MODE ? request('/api/spotify/playlist/add', { method: 'POST', body: JSON.stringify({ playlistId, uris }) }) : { snapshot_id: 'mock' };
}
export async function transfer(deviceId, shouldPlay = false) {
  return LIVE_MODE ? request('/api/spotify/transfer', { method: 'POST', body: JSON.stringify({ deviceId, play: shouldPlay }) }) : { ok: true };
}
export async function getSdkToken() {
  const result = await request('/api/spotify/token');
  return result.accessToken;
}

export const spotifyWebUrl = 'https://open.spotify.com/';
export function openSpotifyPlayer(navigate = url => { window.location.href = url; }) { navigate(spotifyWebUrl); }
export const isConfigured = LIVE_MODE;


import { playing, playlists, searchResults } from '../lib/spotify-mock.js';
const base = { playlists, results: [], query: '', player: playing, sdkStatus: 'ready', loading: false };
export const states = {
  playlists: { ...base, view: 'playlists' },
  search: { ...base, view: 'search', query: 'lovely', results: searchResults },
  'now-playing': { ...base, view: 'playlists' },
  'add-to-playlist': { ...base, view: 'add', selectedTrack: searchResults[0] },
  'sdk-unavailable': { ...base, view: 'unavailable', sdkStatus: 'unavailable', notice: '' },
  loading: { ...base, view: 'playlists', playlists: [], loading: true, player: null, sdkStatus: 'connecting' },
};


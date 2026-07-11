const ART = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#c9a96a"/><stop offset="1" stop-color="#684d72"/></linearGradient></defs>
    <rect width="400" height="400" rx="30" fill="url(#g)"/><circle cx="200" cy="200" r="118" fill="none" stroke="#fff" stroke-opacity=".58" stroke-width="3"/><circle cx="200" cy="200" r="20" fill="#fff" fill-opacity=".72"/>
  </svg>`);

export const playing = {
  active: true, isPlaying: true, type: 'track', progressMs: 72_000, durationMs: 238_000,
  fetchedAt: Date.now(), shuffle: false, repeat: 'off',
  track: { title: 'Golden', artist: 'Jill Scott', album: 'Beautifully Human', artUrl: ART, uri: 'spotify:track:golden' },
  device: { id: 'dashboard', name: 'Dashboard', type: 'Computer', volume: 64 },
};

export const paused = { ...playing, isPlaying: false, progressMs: 116_000, fetchedAt: Date.now() };
export const inactive = { active: false };
export const overflow = {
  ...playing,
  track: { ...playing.track, title: 'This is an intentionally sweeping and beautifully overlong track title', artist: 'A Very Long Artist Name & Friends' },
};
export const episode = {
  ...playing, type: 'episode', durationMs: 2_700_000, progressMs: 540_000,
  track: { ...playing.track, title: 'The quiet architecture of a good morning', artist: 'The Daily Ritual', album: 'Northstar Audio' },
};

export const playlists = [
  { id: 'slow-sunday', uri: 'spotify:playlist:slow-sunday', name: 'Slow Sunday', owner: 'Tim', tracks: 42, artUrl: ART },
  { id: 'kitchen-dance', uri: 'spotify:playlist:kitchen-dance', name: 'Kitchen Dance', owner: 'Tim', tracks: 67, artUrl: ART },
  { id: 'family-classics', uri: 'spotify:playlist:family-classics', name: 'Family Classics', owner: 'Tim', tracks: 31, artUrl: ART },
  { id: 'focus', uri: 'spotify:playlist:focus', name: 'Deep Focus', owner: 'Spotify', tracks: 80, artUrl: ART },
];

export const searchResults = [
  { id: 'one', uri: 'spotify:track:one', title: 'Lovely Day', artist: 'Bill Withers', album: 'Menagerie', artUrl: ART, durationMs: 255_000 },
  { id: 'two', uri: 'spotify:track:two', title: 'September', artist: 'Earth, Wind & Fire', album: 'The Best Of', artUrl: ART, durationMs: 215_000 },
  { id: 'three', uri: 'spotify:track:three', title: 'Come Away With Me', artist: 'Norah Jones', album: 'Come Away With Me', artUrl: ART, durationMs: 198_000 },
];


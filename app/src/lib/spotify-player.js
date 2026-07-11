// Thin lifecycle wrapper around Spotify's Web Playback SDK. The drawer can
// still control any active Connect device when EME/Widevine or the SDK is not
// available; this wrapper never makes the rest of the Spotify UI contingent on
// kiosk audio support.
const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';
let sdkPromise;

export function loadSpotifySdk({ documentRef = document, windowRef = window } = {}) {
  if (windowRef.Spotify) return Promise.resolve(windowRef.Spotify);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Spotify player took too long to load')), 12_000);
    windowRef.onSpotifyWebPlaybackSDKReady = () => { clearTimeout(timeout); resolve(windowRef.Spotify); };
    const script = documentRef.createElement('script');
    script.src = SDK_URL; script.async = true; script.onerror = () => { clearTimeout(timeout); reject(new Error('Spotify player could not load')); };
    documentRef.head.appendChild(script);
  }).catch(error => { sdkPromise = null; throw error; });
  return sdkPromise;
}

export async function createSpotifyPlayer({ getToken, name = 'Dashboard', onState = () => {}, onStatus = () => {} }) {
  const Spotify = await loadSpotifySdk();
  const player = new Spotify.Player({ name, getOAuthToken: async cb => cb(await getToken()), volume: 0.65 });
  let deviceId = null;
  const errors = ['initialization_error', 'authentication_error', 'account_error', 'playback_error'];
  errors.forEach(event => player.addListener(event, ({ message }) => onStatus({ status: 'unavailable', message })));
  player.addListener('autoplay_failed', () => onStatus({ status: 'unavailable', message: 'Tap a playlist to allow dashboard audio' }));
  player.addListener('ready', ({ device_id }) => { deviceId = device_id; onStatus({ status: 'ready', deviceId }); });
  player.addListener('not_ready', () => onStatus({ status: 'unavailable', message: 'Dashboard audio is temporarily unavailable' }));
  player.addListener('player_state_changed', state => {
    if (!state?.track_window?.current_track) return;
    const item = state.track_window.current_track;
    onState({
      active: true, isPlaying: !state.paused, type: item.type === 'episode' ? 'episode' : 'track',
      track: { title: item.name, artist: item.artists?.map(a => a.name).join(', ') || item.album?.name || '', album: item.album?.name || '', artUrl: item.album?.images?.[0]?.url || null, uri: item.uri },
      progressMs: state.position || 0, durationMs: state.duration || 0, fetchedAt: Date.now(),
      device: { id: deviceId, name, type: 'Computer', volume: null }, shuffle: false, repeat: 'off',
    });
  });
  const connected = await player.connect();
  if (!connected) throw new Error('Spotify declined the dashboard player');
  return { player, get deviceId() { return deviceId; }, disconnect: () => player.disconnect() };
}

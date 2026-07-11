import * as spotifyDefault from '../lib/spotify.js';
import { createSpotifyPlayer } from '../lib/spotify-player.js';
import { showToast } from './toast.js';

const SVG = 'viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const CLOSE = `<svg ${SVG}><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const SEARCH = `<svg ${SVG}><circle cx="11" cy="11" r="7"/><path d="M16 16l4 4"/></svg>`;
const PLAY = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;
const PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>`;
const SHUFFLE = `<svg ${SVG}><path d="M16 3h5v5M4 17h3c5 0 6-10 11-10h3M4 7h3c1.7 0 2.9 1.1 3.9 2.6M16 21h5v-5M14 15.5c1 1 2.1 1.5 4 1.5h3"/></svg>`;
const VOLUME = `<svg ${SVG}><path d="M5 10v4h3l4 4V6l-4 4H5zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>`;

export function renderSpotifyDrawer(state) {
  const { view = 'playlists', playlists = [], results = [], query = '', player = null, sdkStatus = 'idle', selectedTrack = null, notice = '', loading = false } = state;
  return `
    <section class="overlay__panel spotify-drawer" role="dialog" aria-modal="true" aria-label="Music">
      <header class="spotify-drawer__header">
        <div>
          <span class="spotify-drawer__eyebrow">Spotify</span>
          <h2 class="overlay__title">Music for this moment</h2>
        </div>
        <button class="overlay__close" data-spotify-drawer-action="close" aria-label="Close music">${CLOSE}</button>
      </header>
      <nav class="spotify-drawer__nav" aria-label="Music sections">
        <button class="spotify-drawer__tab ${view === 'playlists' ? 'is-active' : ''}" data-spotify-drawer-action="view" data-view="playlists">Your playlists</button>
        <button class="spotify-drawer__tab ${view === 'search' ? 'is-active' : ''}" data-spotify-drawer-action="view" data-view="search">Search</button>
        <span class="spotify-drawer__device ${sdkStatus === 'ready' ? 'is-ready' : ''}"><i></i>${sdkLabel(sdkStatus, player)}</span>
      </nav>
      ${notice ? `<div class="spotify-drawer__notice" role="status">${escapeHtml(notice)}</div>` : ''}
      <div class="spotify-drawer__body">
        ${view === 'playlists' ? renderPlaylists(playlists, loading) : ''}
        ${view === 'search' ? renderSearch(query, results, loading) : ''}
        ${view === 'add' ? renderAddPicker(selectedTrack, playlists) : ''}
        ${view === 'unavailable' ? renderUnavailable() : ''}
      </div>
      ${player?.active ? renderNowPlaying(player) : `<footer class="spotify-drawer__quiet">Choose something to begin. The dashboard will stay exactly where you left it.</footer>`}
    </section>`;
}

function renderPlaylists(items, loading) {
  if (loading && !items.length) return '<div class="spotify-drawer__loading">Gathering your playlists<span>•••</span></div>';
  return `<div class="spotify-playlists">${items.map(item => `
    <button class="spotify-playlist" data-spotify-drawer-action="play-playlist" data-uri="${escapeAttr(item.uri)}">
      ${art(item.artUrl, item.name)}
      <span class="spotify-playlist__copy"><strong>${escapeHtml(item.name)}</strong><small>${item.tracks} tracks${item.owner ? ` · ${escapeHtml(item.owner)}` : ''}</small></span>
      <span class="spotify-playlist__play">${PLAY}</span>
    </button>`).join('')}</div>`;
}

function renderSearch(query, results, loading) {
  return `
    <form class="spotify-search" data-spotify-search>
      <span>${SEARCH}</span><input name="q" value="${escapeAttr(query)}" maxlength="100" autocomplete="off" placeholder="Artists, songs, albums" aria-label="Search Spotify">
      <button type="submit">Search</button>
    </form>
    ${loading ? '<div class="spotify-drawer__loading">Searching<span>•••</span></div>' : ''}
    <div class="spotify-results">${results.map(track => `
      <div class="spotify-track">
        ${art(track.artUrl, track.title)}
        <button class="spotify-track__copy" data-spotify-drawer-action="play-track" data-uri="${escapeAttr(track.uri)}">
          <strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist)} · ${escapeHtml(track.album)}</small>
        </button>
        <button class="spotify-track__action" data-spotify-drawer-action="queue" data-uri="${escapeAttr(track.uri)}" aria-label="Add ${escapeAttr(track.title)} to queue">＋</button>
        <button class="spotify-track__action" data-spotify-drawer-action="choose-playlist" data-track="${escapeAttr(JSON.stringify(track))}" aria-label="Add ${escapeAttr(track.title)} to playlist">♡</button>
      </div>`).join('')}</div>
    ${query && !loading && !results.length ? '<p class="spotify-drawer__empty">No tracks found. Try a shorter search.</p>' : ''}`;
}

function renderAddPicker(track, items) {
  return `
    <div class="spotify-add">
      <button class="spotify-add__back" data-spotify-drawer-action="view" data-view="search">← Back to results</button>
      <p class="spotify-add__label">Add <strong>${escapeHtml(track?.title || 'this track')}</strong> to…</p>
      <div class="spotify-add__list">${items.map(item => `<button data-spotify-drawer-action="add" data-id="${escapeAttr(item.id)}"><span>${escapeHtml(item.name)}</span><small>${item.tracks} tracks</small></button>`).join('')}</div>
    </div>`;
}

function renderUnavailable() {
  return `<div class="spotify-drawer__unavailable"><span class="spotify-drawer__unavailable-icon">◌</span><h3>Dashboard audio isn't available</h3><p>You can still browse and control Spotify on a phone or speaker. If this is the first setup, enable Protected Content in Fully Kiosk and try again.</p><button data-spotify-drawer-action="view" data-view="playlists">Browse anyway</button></div>`;
}

function renderNowPlaying(player) {
  const progress = player.durationMs ? Math.min(100, player.progressMs / player.durationMs * 100) : 0;
  return `<footer class="spotify-now">
    ${art(player.track?.artUrl, player.track?.title)}
    <div class="spotify-now__copy"><strong>${escapeHtml(player.track?.title || 'Unknown')}</strong><small>${escapeHtml(player.track?.artist || '')}</small><span><i style="width:${progress}%"></i></span></div>
    <button class="spotify-now__shuffle ${player.shuffle ? 'is-active' : ''}" data-spotify-drawer-action="shuffle" aria-label="${player.shuffle ? 'Turn shuffle off' : 'Turn shuffle on'}">${SHUFFLE}</button>
    <button data-spotify-drawer-action="previous" aria-label="Previous track">‹</button>
    <button class="spotify-now__primary" data-spotify-drawer-action="toggle" aria-label="${player.isPlaying ? 'Pause' : 'Play'}">${player.isPlaying ? PAUSE : PLAY}</button>
    <button data-spotify-drawer-action="next" aria-label="Next track">›</button>
    <label class="spotify-now__volume">${VOLUME}<input data-spotify-volume type="range" min="0" max="100" value="${player.device?.volume ?? 65}" aria-label="Volume"></label>
  </footer>`;
}

function art(url, label) {
  return url ? `<img class="spotify-art" src="${escapeAttr(url)}" alt="">` : `<span class="spotify-art spotify-art--empty" aria-label="${escapeAttr(label || '')}">♪</span>`;
}

function sdkLabel(status, player) {
  if (status === 'ready') return 'Playing here';
  if (status === 'connecting') return 'Preparing dashboard audio';
  if (status === 'unavailable') return player?.device?.name ? `Controlling ${escapeHtml(player.device.name)}` : 'Connect device mode';
  return 'Connect device mode';
}

export function openSpotifyDrawer(spotify = spotifyDefault, { createPlayer = createSpotifyPlayer } = {}) {
  if (document.querySelector('.spotify-overlay')) return () => {};
  const host = document.createElement('div');
  host.className = 'overlay spotify-overlay';
  document.body.appendChild(host);
  document.documentElement.classList.add('has-overlay');
  let state = { view: 'playlists', playlists: [], results: [], query: '', player: spotify.getPlayer().initial, sdkStatus: spotify.isConfigured ? 'connecting' : 'unavailable', selectedTrack: null, notice: '', loading: true };
  let sdk = null;
  let closed = false;
  const listenerAbort = new AbortController();
  const draw = () => { if (!closed) host.innerHTML = renderSpotifyDrawer(state); };
  const set = patch => { state = { ...state, ...patch }; draw(); };
  const close = () => { if (closed) return; closed = true; sdk?.disconnect(); window.dispatchEvent(new CustomEvent('spotify-sdk-disconnected')); listenerAbort.abort(); document.removeEventListener('keydown', onKey); host.remove(); document.documentElement.classList.remove('has-overlay'); };
  const onKey = event => { if (event.key === 'Escape') close(); };

  async function refreshPlayer() {
    try { const player = await spotify.fetchPlayer(); if (player) set({ player }); } catch {}
  }
  async function loadPlaylists() {
    set({ loading: true });
    try { const data = await spotify.getPlaylists(); set({ playlists: data.items, loading: false }); }
    catch { set({ loading: false, notice: 'Your playlists could not be loaded right now.' }); }
  }
  async function run(action, success = '') {
    try { await action(); if (success) set({ notice: success }); setTimeout(refreshPlayer, 300); }
    catch (error) { set({ notice: error.status === 409 ? 'Open Spotify on any device once, then try again.' : 'Spotify could not complete that action.' }); }
  }

  host.addEventListener('submit', async event => {
    if (!event.target.matches('[data-spotify-search]')) return;
    event.preventDefault();
    const query = new FormData(event.target).get('q')?.trim() || '';
    set({ query, loading: true, notice: '' });
    try { const data = await spotify.search(query); set({ results: data.items, loading: false }); }
    catch { set({ loading: false, notice: 'Search is taking a break. Try again in a moment.' }); }
  });
  host.addEventListener('click', event => {
    const button = event.target.closest('[data-spotify-drawer-action]');
    if (!button) { if (event.target === host) close(); return; }
    const action = button.dataset.spotifyDrawerAction;
    if (action === 'close') return close();
    if (action === 'view') return set({ view: button.dataset.view, notice: '' });
    if (action === 'play-playlist') return run(() => spotify.play({ deviceId: sdk?.deviceId, contextUri: button.dataset.uri }), 'Playing on the dashboard');
    if (action === 'play-track') return run(() => spotify.play({ deviceId: sdk?.deviceId, uris: [button.dataset.uri] }));
    if (action === 'queue') return run(() => spotify.queue(button.dataset.uri, sdk?.deviceId), 'Added to queue');
    if (action === 'choose-playlist') { try { return set({ view: 'add', selectedTrack: JSON.parse(button.dataset.track) }); } catch { return; } }
    if (action === 'add') return run(() => spotify.addToPlaylist(button.dataset.id, [state.selectedTrack.uri]), `Added “${state.selectedTrack.title}”`);
    if (action === 'toggle') return run(() => state.player?.isPlaying ? spotify.controls.pause() : spotify.controls.play());
    if (action === 'next') return run(() => spotify.controls.next());
    if (action === 'previous') return run(() => spotify.controls.previous());
    if (action === 'shuffle') return run(() => spotify.controls.shuffle(!state.player?.shuffle));
  });
  host.addEventListener('change', event => {
    if (!event.target.matches('[data-spotify-volume]')) return;
    run(() => spotify.controls.volume(Number(event.target.value)));
  });
  const onState = event => set({ player: event.detail });
  window.addEventListener('spotify-statechange', onState, { signal: listenerAbort.signal });
  document.addEventListener('keydown', onKey);
  draw(); loadPlaylists(); spotify.getPlayer().live.then(player => { if (player) set({ player }); });

  if (spotify.isConfigured) {
    createPlayer({ getToken: spotify.getSdkToken, onState: player => { set({ player }); window.dispatchEvent(new CustomEvent('spotify-statechange', { detail: player })); }, onStatus: status => set({ sdkStatus: status.status, notice: status.status === 'unavailable' ? status.message : '' }) })
      .then(instance => { sdk = instance; })
      .catch(error => set({ sdkStatus: 'unavailable', notice: `${error.message}. You can still control another Spotify device.` }));
  }
  return close;
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
function escapeAttr(value) { return escapeHtml(value); }

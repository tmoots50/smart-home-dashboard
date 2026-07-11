import { showToast } from './toast.js';

const SVG = 'viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"';
const PLAY = `<svg ${SVG}><path d="M8 5v14l11-7z"/></svg>`;
const PAUSE = `<svg ${SVG}><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>`;
const NEXT = `<svg ${SVG}><path d="M6 5v14l9-7zm10 0h2v14h-2z"/></svg>`;

export function renderSpotifyTicker(state) {
  if (!state?.active) return '';
  const progress = Math.max(0, Math.min(100, state.durationMs ? state.progressMs / state.durationMs * 100 : 0));
  const title = escapeHtml(state.track?.title || 'Unknown title');
  const artist = escapeHtml(state.track?.artist || (state.type === 'episode' ? 'Podcast' : 'Unknown artist'));
  return `
    <div class="spotify-ticker__progress" aria-hidden="true"><span style="width:${progress.toFixed(2)}%"></span></div>
    <div class="spotify-ticker__inner">
      ${state.track?.artUrl ? `<img class="spotify-ticker__art" src="${escapeAttr(state.track.artUrl)}" alt="">` : '<span class="spotify-ticker__art spotify-ticker__art--empty">♪</span>'}
      <button class="spotify-ticker__meta" data-spotify-action="open" aria-label="Open music">
        <span class="spotify-ticker__title">${title}</span>
        <span class="spotify-ticker__artist">${artist}</span>
      </button>
      <button class="spotify-ticker__control" data-spotify-action="toggle" aria-label="${state.isPlaying ? 'Pause' : 'Play'}">${state.isPlaying ? PAUSE : PLAY}</button>
      <button class="spotify-ticker__control" data-spotify-action="next" aria-label="Next track">${NEXT}</button>
    </div>`;
}

export function mountSpotifyTicker(element, { getPlayer, controls, onOpen = () => {} }) {
  let state = null;
  let pollTimer = null;
  let tickTimer = null;
  let disposed = false;
  let sdkActive = false;

  const draw = next => {
    if (disposed) return;
    state = next;
    element.innerHTML = renderSpotifyTicker(state);
    element.hidden = !state?.active;
    document.body.classList.toggle('has-spotify-ticker', Boolean(state?.active));
  };

  const schedulePoll = () => {
    clearTimeout(pollTimer);
    if (disposed || document.hidden || sdkActive) return;
    pollTimer = setTimeout(poll, state?.isPlaying ? 10_000 : 60_000);
  };
  const poll = async () => {
    if (disposed || document.hidden) return;
    try { draw(await getPlayer()); } catch {}
    schedulePoll();
  };
  const tick = () => {
    if (!state?.active || !state.isPlaying || document.hidden) return;
    const next = { ...state, progressMs: Math.min(state.durationMs, state.progressMs + 1000) };
    draw(next);
    if (next.durationMs && next.progressMs >= next.durationMs) poll();
  };
  const onVisibility = () => {
    clearTimeout(pollTimer);
    if (!document.hidden) poll();
  };
  const onExternalState = event => {
    sdkActive = event.detail?.device?.name === 'Dashboard';
    draw(event.detail); schedulePoll();
  };
  const onSdkDisconnected = () => { sdkActive = false; poll(); };

  element.addEventListener('click', async event => {
    const action = event.target.closest('[data-spotify-action]')?.dataset.spotifyAction;
    if (!action) return;
    if (action === 'open') return onOpen();
    try {
      if (action === 'toggle') await (state?.isPlaying ? controls.pause() : controls.play());
      if (action === 'next') await controls.next();
      if (state) draw({ ...state, isPlaying: action === 'toggle' ? !state.isPlaying : state.isPlaying });
      setTimeout(poll, 350);
    } catch (error) {
      if (error.status === 409 || error.code === 'NO_ACTIVE_DEVICE') showToast('Nothing playing — tap ♪ to open Spotify', { duration: 4000 });
      else showToast('Spotify could not be reached', { duration: 3500 });
    }
  });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('spotify-statechange', onExternalState);
  window.addEventListener('spotify-sdk-disconnected', onSdkDisconnected);
  tickTimer = setInterval(tick, 1000);
  poll();

  return () => {
    disposed = true; clearTimeout(pollTimer); clearInterval(tickTimer);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('spotify-statechange', onExternalState);
    window.removeEventListener('spotify-sdk-disconnected', onSdkDisconnected);
    document.body.classList.remove('has-spotify-ticker');
  };
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
function escapeAttr(value) { return escapeHtml(value); }

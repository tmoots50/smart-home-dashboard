import { mountClock } from '../widgets/clock.js';
import { mountWeather } from '../widgets/weather.js';
import { mountCalendar } from '../widgets/calendar.js';
import { mountComingUp } from '../widgets/countdown.js';
import { mountTodos } from '../widgets/todos.js';
import { mountGroceries } from '../widgets/groceries.js';
import { renderBible, fitBible } from '../widgets/bible.js';
import { mountCardPhoto } from '../widgets/card-photo.js';
import { openHomeOverlay } from '../widgets/home.js';
import { openCalendarOverlay } from '../widgets/calendar-overlay.js';
import { openMonthCalendar } from '../widgets/month-calendar.js';
import { mountHomeCard } from '../widgets/home-card.js';
import { mountSpotifyTicker } from '../widgets/spotify-ticker.js';
import { openSpotifyDrawer } from '../widgets/spotify-drawer.js';
import { openVoiceOverlay } from '../widgets/voice-overlay.js';

import { getHome, actions as homeActions, deviceActions, isConfigured as homeConfigured } from '../lib/home.js';
import { getUpcoming, getMonth } from '../lib/calendar.js';
import { openHermesChat } from '../lib/telegram.js';
import { fetchPlayer, controls as spotifyControls } from '../lib/spotify.js';
import { voice } from '../lib/voice.js';

import { getMockBibleVerse } from '../lib/bible-mock.js';
import { getPhotos } from '../lib/photos.js';
import {
  getTodos, getGroceries,
  appendTodo, strikeTodo, moveTodo, updateTodo,
  appendGrocery, strikeGrocery, moveGrocery, updateGrocery, setTodoDone, setGroceryDone,
  isConfigured as tasksConfigured,
} from '../lib/tasks.js';
import { showToast } from '../widgets/toast.js';

const SVG_ATTRS = 'viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
const MIC_SVG = `<svg ${SVG_ATTRS}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="21"/><line x1="9" y1="21" x2="15" y2="21"/></svg>`;
const MUSIC_SVG = `<svg ${SVG_ATTRS}><circle cx="6" cy="18" r="3"/><circle cx="18" cy="15" r="3"/><path d="M9 18V5l12-2v12"/></svg>`;
const HOME_SVG = `<svg ${SVG_ATTRS}><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><rect x="10" y="14" width="4" height="6"/></svg>`;
const CAL_SVG = `<svg ${SVG_ATTRS}><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="3" y1="9" x2="21" y2="9"/><circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none"/></svg>`;


// Default location. Override at runtime via ?lat=…&lon=…&location=… on the URL.
const DEFAULT_LOC = { lat: 33.7490, lon: -84.3880, location: 'Atlanta, GA' };

export function renderMorningBriefing(root) {
  const params = new URLSearchParams(window.location.search);
  const loc = {
    lat: parseFloat(params.get('lat')) || DEFAULT_LOC.lat,
    lon: parseFloat(params.get('lon')) || DEFAULT_LOC.lon,
    location: params.get('location') || DEFAULT_LOC.location,
  };
  const todos = getTodos();
  const groceries = getGroceries();
  const verse = getMockBibleVerse();
  const photos = getPhotos();

  root.innerHTML = `
    <main class="briefing">
      <section class="card card--slim">${renderBible(verse)}</section>

      <section class="briefing__topbox">
        <div class="card time-card">
          <div data-slot="clock"></div>
          <hr class="card__divider"/>
          <div data-slot="weather"></div>
          <div class="action-bar">
            <button class="action-btn" data-launch="mic" aria-label="Voice input">${MIC_SVG}</button>
            <button class="action-btn" data-launch="music" aria-label="Music">${MUSIC_SVG}</button>
            <button class="action-btn" data-launch="home" aria-label="Home controls">${HOME_SVG}</button>
            <button class="action-btn" data-launch="month-calendar" aria-label="Month calendar">${CAL_SVG}</button>
          </div>
        </div>
        <div class="card card--photo-fill">
          <div class="card__photo" data-slot="photo"></div>
        </div>
      </section>

      <section class="card" data-slot="calendar"></section>

      <!-- Atlanta Picks unmounted 2026-07-11 (Tim: bring back later); the
           widget + curated feed stay in the codebase. Coming Up owns the row. -->
      <section class="card briefing__updates" data-slot="coming-up"></section>

      <section class="briefing__duo briefing__lists">
        <div class="card" data-slot="todos"></div>
        <div class="briefing__stack">
          <div class="card" data-slot="groceries"></div>
          <div class="card" data-slot="home-card"></div>
        </div>
      </section>
    </main>
    <aside class="spotify-ticker" data-slot="spotify-ticker" hidden aria-label="Now playing"></aside>
  `;

  mountClock(root.querySelector('[data-slot="clock"]'));
  mountWeather(root.querySelector('[data-slot="weather"]'), loc);
  // Family Calendar flavor: ?calflavor=stacked|rail|days|classic wins and
  // persists, so a one-time URL tweak survives kiosk reloads.
  const calFlavor = params.get('calflavor') || localStorage.getItem('calendar:flavor') || undefined;
  if (params.get('calflavor')) {
    try { localStorage.setItem('calendar:flavor', params.get('calflavor')); } catch {}
  }
  mountCalendar(root.querySelector('[data-slot="calendar"]'), { flavor: calFlavor });
  fitBible(root.querySelector('.bible'));
  mountComingUp(root.querySelector('[data-slot="coming-up"]'));

  const todoActions = tasksConfigured
    ? { append: appendTodo, strike: strikeTodo, move: moveTodo, update: updateTodo, setDone: setTodoDone }
    : null;
  const groceryActions = tasksConfigured
    ? { append: appendGrocery, strike: strikeGrocery, move: moveGrocery, update: updateGrocery, setDone: setGroceryDone }
    : null;
  const todosCtl = mountTodos(root.querySelector('[data-slot="todos"]'), todos.initial, todoActions);
  const groceriesCtl = mountGroceries(root.querySelector('[data-slot="groceries"]'), groceries.initial, groceryActions);
  todos.live.then(items => { if (items) todosCtl.setItems(items); });
  groceries.live.then(items => { if (items) groceriesCtl.setItems(items); });

  mountCardPhoto(root.querySelector('[data-slot="photo"]'), photos);
  mountHomeCard(root.querySelector('[data-slot="home-card"]'), getHome, homeActions, deviceActions, { askEntityId: homeConfigured });
  mountSpotifyTicker(root.querySelector('[data-slot="spotify-ticker"]'), {
    getPlayer: fetchPlayer,
    controls: spotifyControls,
    onOpen: () => openSpotifyDrawer(),
  });

  let micLongPressed = false;
  let micHoldTimer = null;
  root.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('[data-launch="mic"]')) return;
    micLongPressed = false;
    clearTimeout(micHoldTimer);
    micHoldTimer = setTimeout(() => {
      micLongPressed = true;
      showToast('Opening the Telegram fallback', { duration: 2500 });
      openHermesChat();
    }, 600);
  });
  for (const eventName of ['pointerup', 'pointercancel', 'pointerleave']) {
    root.addEventListener(eventName, () => clearTimeout(micHoldTimer));
  }

  root.addEventListener('click', (e) => {
    const launch = e.target.closest('[data-launch]')?.dataset.launch;
    if (launch === 'home') {
      openHomeOverlay(getHome(), homeActions);
      return;
    }
    if (launch === 'mic') {
      if (micLongPressed) { micLongPressed = false; return; }
      if (voice.isSupported()) openVoiceOverlay(voice);
      else {
        showToast('Microphone unavailable — opening Telegram', { duration: 3500 });
        openHermesChat();
      }
      return;
    }
    if (launch === 'music') {
      window.open('spotify:', '_blank');
      return;
    }
    if (launch === 'month-calendar') {
      openMonthCalendar({ getMonth });
      return;
    }
    const overlay = e.target.closest('[data-overlay]')?.dataset.overlay;
    if (overlay === 'calendar') {
      openCalendarOverlay(getUpcoming(90), { days: 90, perPerson: 10 });
    }
  });
}

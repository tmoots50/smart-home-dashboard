import { mountClock } from '../widgets/clock.js';
import { mountWeather } from '../widgets/weather.js';
import { mountPick } from '../widgets/pick.js';
import { mountCalendar } from '../widgets/calendar.js';
import { mountComingUp } from '../widgets/countdown.js';
import { mountTodos } from '../widgets/todos.js';
import { mountGroceries } from '../widgets/groceries.js';
import { renderBible, fitBible } from '../widgets/bible.js';
import { mountCardPhoto } from '../widgets/card-photo.js';
import { openHomeOverlay } from '../widgets/home.js';
import { openCalendarOverlay } from '../widgets/calendar-overlay.js';
import { mountHomeCard } from '../widgets/home-card.js';

import { getHome, actions as homeActions, deviceActions, isConfigured as homeConfigured } from '../lib/home.js';
import { getUpcoming } from '../lib/calendar.js';
import { openHermesChat } from '../lib/telegram.js';

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
const PHONE_SVG = `<svg ${SVG_ATTRS}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
const MONEY_SVG = `<svg ${SVG_ATTRS}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;

const LAUNCH_STUBS = {
  music: 'Music view not built yet.',
  phone: 'Phone-call hand-off not wired yet.',
  money: 'Monarch Money view not built yet.',
};


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
            <button class="action-btn" data-launch="phone" aria-label="Phone call">${PHONE_SVG}</button>
            <button class="action-btn" data-launch="money" aria-label="Monarch Money">${MONEY_SVG}</button>
          </div>
        </div>
        <div class="card card--photo-fill">
          <div class="card__photo" data-slot="photo"></div>
        </div>
      </section>

      <section class="card" data-slot="calendar"></section>

      <section class="briefing__duo briefing__duo--updates">
        <div class="card" data-slot="coming-up"></div>
        <div class="card" data-slot="headlines"></div>
      </section>

      <section class="briefing__duo briefing__lists">
        <div class="card" data-slot="todos"></div>
        <div class="briefing__stack">
          <div class="card" data-slot="groceries"></div>
          <div class="card" data-slot="home-card"></div>
        </div>
      </section>
    </main>
  `;

  mountClock(root.querySelector('[data-slot="clock"]'));
  mountWeather(root.querySelector('[data-slot="weather"]'), loc);
  mountCalendar(root.querySelector('[data-slot="calendar"]'));
  fitBible(root.querySelector('.bible'));
  mountPick(root.querySelector('[data-slot="headlines"]'));
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

  root.addEventListener('click', (e) => {
    const launch = e.target.closest('[data-launch]')?.dataset.launch;
    if (launch === 'home') {
      openHomeOverlay(getHome(), homeActions);
      return;
    }
    if (launch === 'mic') {
      showToast('Opening Telegram — hold the mic to talk to Hermes', { duration: 4000 });
      openHermesChat();
      return;
    }
    if (launch && LAUNCH_STUBS[launch]) {
      showToast(LAUNCH_STUBS[launch], { duration: 3000 });
      return;
    }
    const overlay = e.target.closest('[data-overlay]')?.dataset.overlay;
    // 30-day fetch, 7-day view: the overlay groups the first 7 days; events
    // beyond the horizon power the empty week's "Coming up" list.
    if (overlay === 'calendar') openCalendarOverlay(getUpcoming(30), { days: 7 });
  });
}

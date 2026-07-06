import { mountClock } from '../widgets/clock.js';
import { mountWeather } from '../widgets/weather.js';
import { mountAiMessage } from '../widgets/aimessage.js';
import { mountHeadlines } from '../widgets/headlines.js';
import { mountCalendar } from '../widgets/calendar.js';
import { renderCountdown } from '../widgets/countdown.js';
import { mountTodos } from '../widgets/todos.js';
import { mountGroceries } from '../widgets/groceries.js';
import { mountMabel } from '../widgets/mabel.js';
import { renderBible } from '../widgets/bible.js';
import { mountCardPhoto } from '../widgets/card-photo.js';
import { openHomeOverlay } from '../widgets/home.js';

import { getHome, actions as homeActions } from '../lib/home.js';

import { getAiMessage } from '../lib/aimessage.js';
import { getMockCountdowns } from '../lib/countdown-mock.js';
import { getMabel, fetchMabel, isConfigured as mabelConfigured } from '../lib/mabel.js';
import { getMockBibleVerse } from '../lib/bible-mock.js';
import { getPhotos } from '../lib/photos.js';
import {
  getTodos, getGroceries,
  appendTodo, strikeTodo, moveTodo,
  appendGrocery, strikeGrocery, moveGrocery,
  isConfigured as tasksConfigured,
} from '../lib/tasks.js';

const SVG_ATTRS = 'viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
const MIC_SVG = `<svg ${SVG_ATTRS}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="21"/><line x1="9" y1="21" x2="15" y2="21"/></svg>`;
const MUSIC_SVG = `<svg ${SVG_ATTRS}><circle cx="6" cy="18" r="3"/><circle cx="18" cy="15" r="3"/><path d="M9 18V5l12-2v12"/></svg>`;
const HOME_SVG = `<svg ${SVG_ATTRS}><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><rect x="10" y="14" width="4" height="6"/></svg>`;
const PHONE_SVG = `<svg ${SVG_ATTRS}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
const MONEY_SVG = `<svg ${SVG_ATTRS}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;

const LAUNCH_STUBS = {
  mic: 'Microphone not yet installed.',
  music: 'Music view not built yet.',
  phone: 'Phone-call hand-off not wired yet.',
  money: 'Monarch Money view not built yet.',
};

const OVERLAY_STUBS = {
  calendar: 'Full month calendar overlay coming soon.',
  todos: 'Full todo list overlay coming soon.',
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
  const countdowns = getMockCountdowns();
  const todos = getTodos();
  const groceries = getGroceries();
  const mabel = getMabel();
  const verse = getMockBibleVerse();
  const photos = getPhotos();
  const aimessage = getAiMessage();

  root.innerHTML = `
    <main class="briefing">
      <section class="card card--slim">${renderBible(verse)}</section>

      <section class="briefing__topbox">
        <div class="card time-card">
          <div data-slot="clock"></div>
          <hr class="card__divider"/>
          <div data-slot="aimessage"></div>
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
          <div data-slot="mabel"></div>
          <hr class="card__divider"/>
          <div class="card__photo" data-slot="photo"></div>
        </div>
      </section>

      <div class="briefing__columns">
        <div class="briefing__col">
          <div class="card" data-slot="calendar"></div>
          <div class="card">${renderCountdown(countdowns)}</div>
          <div class="card" data-slot="headlines"></div>
        </div>
        <div class="briefing__col">
          <div class="card" data-slot="todos"></div>
          <div class="card" data-slot="groceries"></div>
        </div>
      </div>
    </main>
  `;

  mountClock(root.querySelector('[data-slot="clock"]'));
  mountWeather(root.querySelector('[data-slot="weather"]'), loc);
  mountAiMessage(root.querySelector('[data-slot="aimessage"]'), aimessage);
  mountCalendar(root.querySelector('[data-slot="calendar"]'));
  mountHeadlines(root.querySelector('[data-slot="headlines"]'));

  const todoActions = tasksConfigured ? { append: appendTodo, strike: strikeTodo, move: moveTodo } : null;
  const groceryActions = tasksConfigured ? { append: appendGrocery, strike: strikeGrocery, move: moveGrocery } : null;
  const todosCtl = mountTodos(root.querySelector('[data-slot="todos"]'), todos.initial, todoActions);
  const groceriesCtl = mountGroceries(root.querySelector('[data-slot="groceries"]'), groceries.initial, groceryActions);
  todos.live.then(items => { if (items) todosCtl.setItems(items); });
  groceries.live.then(items => { if (items) groceriesCtl.setItems(items); });

  const mabelCtl = mountMabel(root.querySelector('[data-slot="mabel"]'), mabel.initial);
  mabel.live.then(d => mabelCtl.setData(d));
  if (mabelConfigured) {
    setInterval(() => {
      fetchMabel().then(d => mabelCtl.setData(d)).catch(() => {});
    }, 5 * 60 * 1000);
  }
  mountCardPhoto(root.querySelector('[data-slot="photo"]'), photos);

  root.addEventListener('click', (e) => {
    const launch = e.target.closest('[data-launch]')?.dataset.launch;
    if (launch === 'home') {
      openHomeOverlay(getHome(), homeActions);
      return;
    }
    if (launch && LAUNCH_STUBS[launch]) {
      window.alert(LAUNCH_STUBS[launch]);
      return;
    }
    const overlay = e.target.closest('[data-overlay]')?.dataset.overlay;
    if (overlay && OVERLAY_STUBS[overlay]) window.alert(OVERLAY_STUBS[overlay]);
  });
}

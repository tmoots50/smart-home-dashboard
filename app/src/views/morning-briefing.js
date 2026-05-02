import { mountClock } from '../widgets/clock.js';
import { renderWeather } from '../widgets/weather.js';
import { renderOnThisDay } from '../widgets/onthisday.js';
import { renderAiMessage } from '../widgets/aimessage.js';
import { renderHeadlines } from '../widgets/headlines.js';
import { renderCalendar } from '../widgets/calendar.js';
import { renderCountdown } from '../widgets/countdown.js';
import { mountTodos } from '../widgets/todos.js';
import { mountGroceries } from '../widgets/groceries.js';
import { mountMabel } from '../widgets/mabel.js';
import { renderBible } from '../widgets/bible.js';
import { mountCardPhoto } from '../widgets/card-photo.js';

import { getMockWeather } from '../lib/weather-mock.js';
import { getMockOnThisDay } from '../lib/onthisday-mock.js';
import { getMockAiMessage } from '../lib/aimessage-mock.js';
import { getMockHeadlines } from '../lib/headlines-mock.js';
import { getMockCalendar } from '../lib/calendar-mock.js';
import { getMockCountdowns } from '../lib/countdown-mock.js';
import { getMockTodos } from '../lib/todos-mock.js';
import { getMockGroceries } from '../lib/groceries-mock.js';
import { getMockMabel } from '../lib/mabel-mock.js';
import { getMockBibleVerse } from '../lib/bible-mock.js';
import { getMockPhotos } from '../lib/photos-mock.js';

const SVG_ATTRS = 'viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
const MIC_SVG = `<svg ${SVG_ATTRS}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="21"/><line x1="9" y1="21" x2="15" y2="21"/></svg>`;
const MUSIC_SVG = `<svg ${SVG_ATTRS}><circle cx="6" cy="18" r="3"/><circle cx="18" cy="15" r="3"/><path d="M9 18V5l12-2v12"/></svg>`;
const LIGHT_SVG = `<svg ${SVG_ATTRS}><path d="M9 18h6M10 21h4M12 2a7 7 0 0 0-4 12.5V17h8v-2.5A7 7 0 0 0 12 2z"/></svg>`;
const PHONE_SVG = `<svg ${SVG_ATTRS}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
const MONEY_SVG = `<svg ${SVG_ATTRS}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;

const LAUNCH_STUBS = {
  mic: 'Microphone not yet installed.',
  music: 'Music view not built yet.',
  lights: 'Lights view not built yet.',
  phone: 'Phone-call hand-off not wired yet.',
  money: 'Monarch Money view not built yet.',
};

const OVERLAY_STUBS = {
  calendar: 'Full month calendar overlay coming soon.',
  todos: 'Full todo list overlay coming soon.',
};

export function renderMorningBriefing(root) {
  const weather = getMockWeather();
  const headlines = getMockHeadlines();
  const calendar = getMockCalendar();
  const countdowns = getMockCountdowns();
  const todos = getMockTodos();
  const groceries = getMockGroceries();
  const mabel = getMockMabel();
  const verse = getMockBibleVerse();
  const photos = getMockPhotos();
  const onthisday = getMockOnThisDay();
  const aimessage = getMockAiMessage();

  root.innerHTML = `
    <main class="briefing">
      <section class="card card--slim">${renderBible(verse)}</section>

      <section class="briefing__topbox">
        <div class="card time-card">
          <div data-slot="clock"></div>
          <hr class="card__divider"/>
          ${renderOnThisDay(onthisday)}
          ${renderAiMessage(aimessage)}
          <hr class="card__divider"/>
          ${renderWeather(weather)}
          <div class="action-bar">
            <button class="action-btn" data-launch="mic" aria-label="Voice input">${MIC_SVG}</button>
            <button class="action-btn" data-launch="music" aria-label="Music">${MUSIC_SVG}</button>
            <button class="action-btn" data-launch="lights" aria-label="Lights">${LIGHT_SVG}</button>
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
          <div class="card">${renderCalendar(calendar)}</div>
          <div class="card">${renderCountdown(countdowns)}</div>
          <div class="card">${renderHeadlines(headlines)}</div>
        </div>
        <div class="briefing__col">
          <div class="card" data-slot="todos"></div>
          <div class="card" data-slot="groceries"></div>
        </div>
      </div>
    </main>
  `;

  mountClock(root.querySelector('[data-slot="clock"]'));
  mountTodos(root.querySelector('[data-slot="todos"]'), todos);
  mountGroceries(root.querySelector('[data-slot="groceries"]'), groceries);
  mountMabel(root.querySelector('[data-slot="mabel"]'), mabel);
  mountCardPhoto(root.querySelector('[data-slot="photo"]'), photos);

  root.addEventListener('click', (e) => {
    const launch = e.target.closest('[data-launch]')?.dataset.launch;
    if (launch && LAUNCH_STUBS[launch]) {
      window.alert(LAUNCH_STUBS[launch]);
      return;
    }
    const overlay = e.target.closest('[data-overlay]')?.dataset.overlay;
    if (overlay && OVERLAY_STUBS[overlay]) window.alert(OVERLAY_STUBS[overlay]);
  });
}

// QA harness loader — renders one widget in one fixture state, isolated from
// the briefing view, with the same CSS/theme/interaction wiring as production.
//
//   /harness.html?widget=calendar&state=typical
//   /harness.html?widget=calendar-overlay&state=overflow&theme=light&scale=0.6
//
// Adding a widget to the harness = one entry in WIDGETS below plus a
// co-located <widget>.fixtures.js exporting `states`. Keep mounts faithful to
// how morning-briefing.js wires the widget (same wrappers, same delegation),
// otherwise the harness measures a layout the wall never shows.
//
// Determinism: specs freeze page time (page.clock.install) BEFORE navigation,
// so fixtures built from `new Date()` resolve against tests/qa/clock.js
// FIXED_NOW. No fetches happen here — fixtures only.
import { renderCalendar } from '../widgets/calendar.js';
import { openCalendarOverlay } from '../widgets/calendar-overlay.js';
import { openEventDetail } from '../widgets/event-detail.js';
import { states as calendarStates } from '../widgets/calendar.fixtures.js';
import { states as calendarOverlayStates } from '../widgets/calendar-overlay.fixtures.js';
import { renderWeather } from '../widgets/weather.js';
import { renderPick, attachPickHandlers } from '../widgets/pick.js';
import { openArticleOverlay } from '../widgets/article-overlay.js';
import { states as articleOverlayStates } from '../widgets/article-overlay.fixtures.js';
import { mountComingUp } from '../widgets/countdown.js';
import { mountTodos } from '../widgets/todos.js';
import { mountGroceries } from '../widgets/groceries.js';
import { states as weatherStates } from '../widgets/weather.fixtures.js';
import { states as pickStates } from '../widgets/pick.fixtures.js';
import { states as countdownStates } from '../widgets/countdown.fixtures.js';
import { states as todosStates } from '../widgets/todos.fixtures.js';
import { states as groceriesStates } from '../widgets/groceries.fixtures.js';
import { renderSpotifyTicker } from '../widgets/spotify-ticker.js';
import { states as spotifyTickerStates } from '../widgets/spotify-ticker.fixtures.js';
import { renderSpotifyDrawer } from '../widgets/spotify-drawer.js';
import { states as spotifyDrawerStates } from '../widgets/spotify-drawer.fixtures.js';
import { renderVoiceOverlay } from '../widgets/voice-overlay.js';
import { states as voiceOverlayStates } from '../widgets/voice-overlay.fixtures.js';
import { openMonthCalendar } from '../widgets/month-calendar.js';
import { states as monthCalendarStates } from '../widgets/month-calendar.fixtures.js';

const WIDGETS = {
  calendar: {
    states: calendarStates,
    mount(root, fixture) {
      // Mirrors morning-briefing.js: card wrapper + delegated row-tap → detail.
      root.innerHTML = `
        <main class="briefing">
          <section class="card" data-slot="calendar"></section>
        </main>`;
      const slot = root.querySelector('[data-slot="calendar"]');
      slot.innerHTML = renderCalendar(fixture.data, new Date(), { flavor: fixture.flavor });
      slot.addEventListener('click', (e) => {
        const row = e.target.closest('[data-event]');
        if (!row) return;
        try { openEventDetail(JSON.parse(row.dataset.event)); } catch {}
      });
    },
  },

  'calendar-overlay': {
    states: calendarOverlayStates,
    mount(root, events) {
      // The real overlay mounts over the briefing; give it the same backdrop.
      root.innerHTML = '<main class="briefing"></main>';
      openCalendarOverlay({ initial: events }, { days: 90, perPerson: 10 });
    },
  },

  weather: {
    states: weatherStates,
    mount(root, fixture) {
      root.innerHTML = `<main class="briefing"><section class="card time-card"><div data-slot="weather"></div></section></main>`;
      root.querySelector('[data-slot="weather"]').innerHTML = renderWeather(fixture);
    },
  },

  pick: {
    states: pickStates,
    mount(root, fixture) {
      root.innerHTML = `<main class="briefing"><section class="briefing__duo briefing__duo--updates"><div></div><section class="card" data-slot="pick"></section></section></main>`;
      const slot = root.querySelector('[data-slot="pick"]');
      slot.innerHTML = renderPick(fixture);
      attachPickHandlers(slot); // same tap → article-overlay delegation as production
    },
  },

  'article-overlay': {
    states: articleOverlayStates,
    mount(root, fixture) {
      root.innerHTML = '<main class="briefing"></main>';
      openArticleOverlay(fixture);
    },
  },

  countdown: {
    states: countdownStates,
    mount(root, fixture) {
      localStorage.removeItem('coming-up:dismissed:v1');
      // Mirrors morning-briefing.js: Coming Up owns the full-width updates row.
      root.innerHTML = `<main class="briefing"><section class="card briefing__updates" data-slot="countdown"></section></main>`;
      mountComingUp(root.querySelector('[data-slot="countdown"]'), { initial: fixture, live: Promise.resolve(fixture) });
    },
  },

  todos: {
    states: todosStates,
    mount(root, fixture) {
      root.innerHTML = `<main class="briefing"><section class="briefing__duo briefing__lists"><section class="card" data-slot="todos"></section><div></div></section></main>`;
      mountTodos(root.querySelector('[data-slot="todos"]'), fixture, {
        append: async () => {}, strike: async () => {}, move: async () => {}, update: async () => {}, setDone: async () => {},
      });
    },
  },

  groceries: {
    states: groceriesStates,
    mount(root, fixture) {
      root.innerHTML = `<main class="briefing"><section class="briefing__duo briefing__lists"><div></div><section class="card" data-slot="groceries"></section></section></main>`;
      mountGroceries(root.querySelector('[data-slot="groceries"]'), fixture, {
        append: async () => {}, strike: async () => {}, move: async () => {}, update: async () => {}, setDone: async () => {},
      });
    },
  },

  'spotify-ticker': {
    states: spotifyTickerStates,
    mount(root, fixture) {
      root.innerHTML = `<main class="briefing"></main><aside class="spotify-ticker" aria-label="Now playing">${renderSpotifyTicker(fixture)}</aside>`;
      root.querySelector('.spotify-ticker').hidden = !fixture.active;
      document.body.classList.toggle('has-spotify-ticker', Boolean(fixture.active));
    },
  },

  'spotify-drawer': {
    states: spotifyDrawerStates,
    mount(root, fixture) {
      root.innerHTML = `<main class="briefing"></main><div class="overlay spotify-overlay">${renderSpotifyDrawer(fixture)}</div>`;
      document.documentElement.classList.add('has-overlay');
    },
  },

  'voice-overlay': {
    states: voiceOverlayStates,
    mount(root, fixture) {
      root.innerHTML = `<main class="briefing"></main><div class="overlay voice-overlay-host">${renderVoiceOverlay(fixture)}</div>`;
      document.documentElement.classList.add('has-overlay');
    },
  },

  'month-calendar': {
    states: monthCalendarStates,
    mount(root, fixture) {
      root.innerHTML = '<main class="briefing"></main>';
      // Stub source keyed by `${year}-${month0}` — nav across months works
      // without any fetch.
      openMonthCalendar({
        getMonth: (y, m) => ({ initial: fixture.months?.[`${y}-${m}`] ?? [], live: Promise.resolve(null) }),
      });
    },
  },
};

const params = new URLSearchParams(window.location.search);
const widgetName = params.get('widget');
const stateName = params.get('state') ?? 'typical';

// Match production knobs so profiles can exercise them (see devices.js).
const theme = params.get('theme');
if (theme) document.documentElement.dataset.theme = theme;
const scale = parseFloat(params.get('scale'));
if (scale > 0 && scale < 4) document.documentElement.style.fontSize = `${scale * 16}px`;

const root = document.querySelector('#app');
const widget = WIDGETS[widgetName];
const fixture = widget?.states?.[stateName];

if (!widget) {
  root.innerHTML = `<pre data-harness-error>Unknown widget "${widgetName}". Known: ${Object.keys(WIDGETS).join(', ')}</pre>`;
} else if (fixture === undefined) {
  root.innerHTML = `<pre data-harness-error>Unknown state "${stateName}" for ${widgetName}. Known: ${Object.keys(widget.states).join(', ')}</pre>`;
} else {
  widget.mount(root, fixture);
  document.documentElement.dataset.harnessReady = '1';
}

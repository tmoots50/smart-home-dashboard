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
      slot.innerHTML = renderCalendar(fixture.data, new Date());
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
      openCalendarOverlay({ initial: events }, { days: 7 });
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

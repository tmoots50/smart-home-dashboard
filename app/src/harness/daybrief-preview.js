// Loader for daybrief-preview.html — the Morning Brief card in one fixture
// state, mounted exactly as morning-briefing.js mounts it. Kept separate from
// harness.js while other harness work is in flight; the daybrief entry can
// fold into WIDGETS there once that settles.

import { mountDaybrief } from '../widgets/daybrief.js';
import { states } from '../widgets/daybrief.fixtures.js';

const params = new URLSearchParams(window.location.search);
const stateName = params.get('state') ?? 'typical';

const theme = params.get('theme');
if (theme) document.documentElement.dataset.theme = theme;
const scale = parseFloat(params.get('scale'));
if (scale > 0 && scale < 4) document.documentElement.style.fontSize = `${scale * 16}px`;

const root = document.querySelector('#app');
const fixture = states[stateName];

if (fixture === undefined && stateName !== 'empty') {
  root.innerHTML = `<pre data-harness-error>Unknown state "${stateName}". Known: ${Object.keys(states).join(', ')}</pre>`;
} else {
  localStorage.removeItem('daybrief:dismissed:v1');
  // "Now" pinned to 8:15a so the widget's noon cutoff never hides a fixture.
  root.innerHTML = `<main class="briefing"><section class="card daybrief" data-slot="daybrief" hidden></section></main>`;
  const morning = new Date();
  morning.setHours(8, 15, 0, 0);
  mountDaybrief(
    root.querySelector('[data-slot="daybrief"]'),
    { initial: fixture, live: Promise.resolve(fixture) },
    { now: () => morning },
  );
  document.documentElement.dataset.harnessReady = '1';
}

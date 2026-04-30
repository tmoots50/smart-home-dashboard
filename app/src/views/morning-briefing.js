import { mountClock } from '../widgets/clock.js';

export function renderMorningBriefing(root) {
  root.innerHTML = `
    <main class="briefing">
      <section class="briefing__clock" data-slot="clock"></section>
      <section class="briefing__placeholder">
        <p>weather · calendar · todos · photo · message · headlines</p>
        <p class="muted">widgets land here as they're built</p>
      </section>
    </main>
  `;

  mountClock(root.querySelector('[data-slot="clock"]'));
}

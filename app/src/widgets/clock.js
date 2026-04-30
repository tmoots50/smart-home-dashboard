const TIME_FMT = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

export function renderClock(now = new Date()) {
  return `
    <div class="clock">
      <div class="clock__time">${TIME_FMT.format(now)}</div>
      <div class="clock__date">${DATE_FMT.format(now)}</div>
    </div>
  `;
}

export function mountClock(slot) {
  const tick = () => { slot.innerHTML = renderClock(new Date()); };
  tick();
  setInterval(tick, 1000 * 30);
}

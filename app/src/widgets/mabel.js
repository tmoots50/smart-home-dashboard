const WINDOW_HOURS = 24;
const HOUR_MS = 3_600_000;
const FEED_TYPES = new Set(['nurse', 'bottle']);
const TIME_FMT = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function renderMabel(data, now = new Date()) {
  const events = data.events ?? [];
  const lastFeed = findLastFeed(events);
  const sinceLast = lastFeed ? formatSince(new Date(lastFeed.at), now) : '—';
  const lastFeedDetail = lastFeed
    ? `${lastFeed.type} at ${TIME_FMT.format(new Date(lastFeed.at))}`
    : '';
  const age = formatAge(new Date(data.birthDate), now);
  const counts = countByType(events, now);

  return `
    <div class="mabel">
      <div class="mabel__top">
        <h2 class="card__title">${escapeHtml(data.childName)} · ${age}</h2>
        <div class="mabel__since">
          <div class="mabel__since-value">${sinceLast}</div>
          <div class="mabel__since-label">since last feed</div>
          ${lastFeedDetail ? `<div class="mabel__since-detail">${escapeHtml(lastFeedDetail)}</div>` : ''}
        </div>
      </div>
      <div class="mabel__counts">
        <span class="mabel__count"><span class="mabel__dot mabel__dot--bottle"></span>${counts.bottles} bottles</span>
        <span class="mabel__count"><span class="mabel__dot mabel__dot--nurse"></span>${counts.nurses} nursings</span>
        <span class="mabel__count"><span class="mabel__dot mabel__dot--pee"></span>${counts.pees} wets</span>
        <span class="mabel__count"><span class="mabel__dot mabel__dot--poop"></span>${counts.poops} dirties</span>
      </div>
      <div class="mabel__counts-label">Last 24 hours</div>
    </div>
  `;
}

export function mountMabel(slot, data) {
  const tick = () => { slot.innerHTML = renderMabel(data, new Date()); };
  tick();
  setInterval(tick, 60_000);
}

function findLastFeed(events) {
  let last = null;
  for (const e of events) {
    if (!FEED_TYPES.has(e.type)) continue;
    if (!last || new Date(e.at) > new Date(last.at)) last = e;
  }
  return last;
}

function countByType(events, now) {
  const cutoff = now - WINDOW_HOURS * HOUR_MS;
  let bottles = 0, nurses = 0, pees = 0, poops = 0;
  for (const e of events) {
    if (new Date(e.at) < cutoff) continue;
    if (e.type === 'bottle') bottles++;
    else if (e.type === 'nurse') nurses++;
    else if (e.type === 'pee') pees++;
    else if (e.type === 'poop') poops++;
  }
  return { bottles, nurses, pees, poops };
}

function formatSince(then, now) {
  const ms = now - then;
  if (ms < 0) return '—';
  const h = Math.floor(ms / HOUR_MS);
  const m = Math.floor((ms % HOUR_MS) / 60_000);
  return `${h}h ${m}m`;
}

function formatAge(birth, now) {
  const days = Math.floor((now - birth) / 86_400_000);
  if (days < 14) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

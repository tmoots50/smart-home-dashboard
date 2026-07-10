// The frozen "now" every QA spec installs via page.clock.install() BEFORE
// navigation. Inside the page, `new Date()` then returns exactly this moment,
// so fixture dates (built relative to runtime now — see *.fixtures.js) and
// day labels ("Today", "Tomorrow", "Wednesday…") are identical on every run.
//
// Wednesday 07:30 on purpose: mid-week gives the 7-day overlay a mix of
// near-day labels and weekday names, and 07:30 is before every fixture event
// so nothing is filtered out as "already past" by the calendar card.
export const FIXED_NOW = new Date(2026, 6, 15, 7, 30, 0); // Wed 2026-07-15 07:30 local

# UI/UX inspiration

A working catalog of prior art for the wall dashboard. Two purposes:

1. **Steal from now.** Patterns we want in v1 — kiosk plumbing, layout ideas, widget concepts that fit a "two adults + a one-month-old" household.
2. **Parking lot for later.** Sleek designs we admire but don't need yet. Revisit once v1 is on the wall and we know what's actually missing.

Append-only. Preserve *why* something is interesting, not just the link.

---

## Tier 1 — Direct references (Tim-curated)

### geerlingguy/pi-kiosk
https://github.com/geerlingguy/pi-kiosk

**What it is:** Minimal Pi kiosk launcher. Shell scripts + systemd. Boots straight into fullscreen Chromium pointing at any URL.

**Steal:**
- The systemd-unit-as-autostart pattern. Cleaner than `.xinitrc` hacks.
- `wlr-randr` for screen rotation under Wayland, with `kanshi` to persist. Modern Pi OS is Wayland-first now — old `xrandr` tutorials will mislead us.
- EEPROM tweaks for low idle power. Cited 140× shutdown-power reduction.

**Skip:**
- No screen-blank/dim-on-idle yet (open issue). We'll need our own.
- No cursor-hide config documented. Add `--noerrdialogs --disable-infobars --kiosk` and `unclutter` ourselves.

**Why it matters:** This is the kiosk-host *plumbing*, not the dashboard. Solves the boring "make Chromium come up clean on boot" problem so we can spend our time on the UI. Most kiosk setup tutorials online are stale (X11 era); Geerling's is current.

---

### caspii/dinkydash
https://github.com/caspii/dinkydash

**What it is:** AI-generated family dashboard. Flask + Bootstrap 5 + Claude API. Regenerates content every morning at 6am.

**Steal:**
- **Daily regeneration cadence.** The dashboard isn't static — it has a heartbeat. Worth thinking about for our build: what content earns a daily refresh vs. real-time vs. never-changes?
- **Countdown widgets.** Birthdays, milestones, "days until X." For us: days until paternity leave ends, Mabel's growth milestones, anniversaries.
- **Family-member cards with photos.** Identity on the wall — the dashboard is a mirror of the household, not just an info panel.
- **800×480 target.** Confirms small-screen kiosks are a viable form factor; constrains widget density honestly.

**Skip / adapt:**
- Big-family chore rotations and "kids' daily challenge" widgets don't apply yet. Keep the slot, change the content. New-baby version: feed/sleep/diaper recap, who's on point tonight, last pediatrician note.
- Bootstrap 5 + emoji-heavy aesthetic is functional but not the visual ceiling we want. Treat as a content-architecture reference, not a design reference.

**Why it matters:** It's the closest existing project to *our* use case. The widget set translates almost 1:1 if we substitute "small-family-with-newborn" for "big-family-with-kids."

---

### MagicMirror² ecosystem
https://magicmirror.builders/ · https://docs.magicmirror.builders/ · 3rd-party module index: https://kristjanesperanto.github.io/MagicMirror-3rd-Party-Modules/

**What it is:** The reference open-source modular smart-display platform. Node-based, file-config'd, ten-year-old ecosystem. Hundreds of community modules.

**Treat as:** A design and concept buffet, not a stack to adopt. We're not building on MM², but we should mine it relentlessly for module ideas, layout patterns, and edge cases other people already hit.

**Steal-list (parking lot — see "Module ideas worth porting" below).**

**Why it matters:** Anything we think we want, somebody has already built a MagicMirror module for. Search there first before designing from scratch.

---

## Tier 2 — Adjacent prior art

### Caspii forum thread — "My Family Dashboard made with Magic Mirror 2"
https://forum.magicmirror.builders/topic/11541/my-family-dashboard-made-with-magic-mirror-2

42" monitor mounted *vertical* (1280×1024 portrait), running clock + `MMM-CalendarExt2` + `MMM-DarkSkyForecast` + `MMM-GooglePhotos` as a rotating background.

**Steal:** The "photos as living background, widgets as transparent overlay" pattern. Solves the "blank screen feels institutional" problem without making the dashboard a photo frame. Worth prototyping in v2.

### AxelDeneu/TandenDash
https://github.com/AxelDeneu/TandenDash

Modern open-source MagicMirror alternative. Nuxt 3 + Vue 3 + TypeScript + Tailwind + Shadcn + Drizzle/SQLite. Touch-first, drag-and-drop layout, plugin architecture.

**Steal (concept-only):** The plugin/widget contract — widgets self-describe their config schema and the host renders the config UI. We may want this if we ever expose configuration to non-engineers (i.e., my wife). For v1 we hard-code; for v2 this is the reference architecture.

**Skip:** The whole stack. We're on Vite + vanilla JS. Don't add a framework just to mirror their structure.

### bdunn44/kitchen-dashboard
https://github.com/bdunn44/kitchen-dashboard

Home Assistant Lovelace dashboard, portrait orientation, designed for a wall tablet. Weather + vehicle + quick actions + to-dos + calendar in a clean grid.

**Steal:** Layout density and information hierarchy for portrait orientation. Even if we end up landscape, the discipline of "what earns a tile at this size" is the same.

### z1c0/dashydash
https://github.com/z1c0/dashydash

"Appointments, family pictures, bus connections, other info at a glance." Older project, simpler stack.

**Steal:** Transit/commute as a first-class widget. Even on paternity leave, "is my wife's bus delayed" is the kind of low-effort, high-relevance signal a kitchen wall earns its keep on.

### blanck/homeboard
https://github.com/blanck/homeboard

Touchscreen kitchen board: weather + news + family calendar + stocks + Sonos control.

**Steal:** Audio control as a tile (Sonos/Spotify "now playing" + skip button). Especially relevant for the new-parent context — "skip this song without waking the baby" is a real ergonomics win for a wall display vs. a phone.

> **Hardware reality:** No Sonos. Alexas are the only audio endpoints; Alexa exposes no public "now playing + skip" control surface. Spotify Connect against an Echo *might* work via Spotify Web API. Treat this as a v2 concept, not v1.

### Home Assistant dashboard ecosystem
- **Mushroom cards** — minimalist card library, near-default for "best HA dashboard" Reddit posts.
- **Themes:** Catppuccin (warm pastels), Mushroom Shadow (dark/sleek), Noctis (deep midnight), iOS Theme.
- **GlassHome** — React-based HA dashboard with drag-and-drop visual editor.

**Steal (visual ONLY):** Mushroom is the current de facto sleek aesthetic for home dashboards. The visual language — soft shadows, restrained palette, large-radius cards, breathing room — is the bar to clear.

> **Hardware reality:** No Home Assistant instance exists in this household. Don't propose wiring widgets to HA. Take the *look*, not the platform. If a future widget genuinely needs HA's entity model, that's a separate "stand up HA" decision, not a quiet dependency.

References:
- https://joinhomeshift.com/home-assistant-dashboard-examples
- https://community.home-assistant.io/t/mobile-first-dashboard-a-minimalist-and-user-friendly-ui-for-your-dashboard/535580

---

## Module ideas worth porting (parking lot)

Sourced from the MagicMirror 3rd-party module index and forum threads. None of these are v1 work — log them so we don't lose them.

- **Calendar with smart event styling** — `MMM-CalendarExt2`-style: per-event color, icons by category, multi-calendar overlay.
- **Photo background slideshow** — Google Photos / iCloud shared album feed, slow Ken Burns pan, low contrast so widgets stay readable.
- **Weather chart** — `MMM-WeatherChart` style: hourly precip + temp curve in one inline graphic, not a row of icons.
- **Spotify / Sonos now-playing** — album art tile, scrub bar, skip controls.
- **Transit countdown** — next bus/train, with a "leave by" pill that turns amber as the window closes.
- **Smart light scene tiles** — "movie", "dinner", "winddown" presets. One tap. *(Hardware reality: requires lights we don't have. Smart-plug on/off is the v1 ceiling — a "lamps off" tile is feasible; "scenes" is not.)*
- **Birthday/milestone countdowns** — already in DinkyDash; we want it.
- **Daily AI briefing** — DinkyDash's headliner. Generated overnight, a paragraph or two of household-relevant context.
- **Air quality / pollen / UV index** — newborn-relevant. Not a v1, but flagged.
- **Doorbell / package camera snapshot** — last 30 sec of the front door cam, on-demand. *(Hardware reality: no cameras. Skip until that changes.)*
- **Quick voice memo capture** — "tap to record a note for later." Pairs with the family-organizer pattern of capturing thoughts where you are.

---

## Emerging design principles

Patterns showing up across multiple references that we should adopt or argue with explicitly:

1. **Glanceable > interactive.** Most successful family dashboards optimize for "read it walking past" over "tap to drill in." Touch is a bonus, not the primary mode.
2. **Photos make the wall feel alive.** Without a rotating background, even nice widgets read as "kiosk." Plan for this slot.
3. **Density is the enemy.** Every reference dashboard we like has fewer tiles than feels right at first. Cut, then cut again.
4. **The bar for visual quality is Mushroom-cards / iOS aesthetic.** Soft, dark-mode-first, generous radii, restrained color. Bootstrap-default looks like a SaaS admin panel and ages instantly.
5. **Identity belongs on the wall.** Family-member cards, names, photos. The dashboard is *ours*, not a generic info panel.
6. **Refresh has a heartbeat.** Daily regeneration of *something* (greeting, fun fact, photo) keeps the wall from going stale even when no data changed.

---

## How to use this file

- When starting a new widget, scan the parking-lot list and the module-ideas section first — odds are it's been thought about.
- When making a visual choice (color, type, spacing), check whether it survives the "Mushroom bar" test.
- New finds: append to Tier 2 or the parking lot. Don't reorganize aggressively — preserve the discovery order so future-us can see how taste evolved.

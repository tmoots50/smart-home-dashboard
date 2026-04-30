# Smart Home Dashboard — Spec

The durable "what we're building" contract. Read top to bottom before suggesting changes.

---

## Project summary

A wall-mounted smart home dashboard for my family home. A 15.6" portrait-orientation touchscreen monitor, driven by a Raspberry Pi 5, runs a custom web app in Chromium kiosk mode. The dashboard lives in our master bathroom, between two existing mirror cabinets, above an existing outlet.

**Three user-facing goals:**
1. **Family calendar** — what's happening today, this week
2. **Digital photo album** — slideshow of family photos
3. **Budget tracker** — spending overview (deferred to v2+)

**Aesthetic goal:** Samsung Frame TV vibes — sleek, minimal, blends into the wall, doesn't look like a hobbyist gadget. My wife has high décor standards and the dashboard has to clear that bar.

**Career goal:** I'm on paternity leave, ~6 weeks remaining, job hunting. This project is meant to produce a public GitHub repo with a strong README, screenshots, and demo videos that demonstrate technical ability. Software-heavy time is more valuable than hardware-tinkering time. Android dev experience is more job-marketable than Pi hobbyist tinkering for my goals — but a thoughtfully-built dashboard that's been live in my home for months tells a credible "I can ship and operate real systems" story.

---

## Acceptance criteria

### Operational
- Boots into kiosk mode with no human intervention
- Survives power cycles and WiFi blips without intervention
- Stays awake during the morning shower window (humidity protection)
- Mounted on the master-bathroom wall and in daily use

### Product
- Morning briefing view shows time/date/weather, today's calendar, family todos, a rotating photo, an occasional message from Tim, and curated headlines
- At least two custom-built widgets (vs. off-the-shelf) running on it
- Aesthetic clears wife's décor bar — editorial-magazine restraint, no hobbyist-gadget look

### Portfolio
- Public GitHub repo with a strong README, screenshots, and a demo video
- Documented enough that a stranger could rebuild it
- Decision log preserved so the *why* behind choices is legible

---

## How we got here (decision history)

### Original plan
A 24" touchscreen monitor (ViewSonic TD2455 or Elo 2402L) wall-mounted in portrait orientation, ~$500–620 total budget, Pi 5 or Intel N100 brain, custom HTML/CSS/JS in Chromium kiosk mode.

### Pivots that happened
1. **Location lock-in: master bathroom.** Specifically, the wall between two existing raised/beveled mirror cabinets above an existing outlet. This constrains the install in two big ways:
   - **Size:** the gap between the mirror cabinets is ~15"×10" → killed the 24" monitor plan.
   - **Humidity:** wife showers daily ~15min hot water, mirrors fog up (room hits dew point), exhaust fan is weak, room stays humid ~15min after shower. Moderate-to-heavy exposure. Shower has its own glass enclosure which helps somewhat.
2. **Display sizing pivot.** Dropped the 24" target. v1 is a 15.6" portable monitor in the gap.
3. **Tablet detour and return.** Briefly considered Android tablet (Apolosign) for v1 because of touch quality and bezel. Killed it: battery swelling on always-on devices, plus losing the Pi-as-learning-platform value. Came back to Pi + portable monitor.
4. **Display purchase: cocopar 15.6"** — 1080P FHD touchscreen, 90% sRGB, HDMI + USB-C, VESA-mountable, built-in speaker. Consumer-grade (estimated 18–30 month lifespan in this bathroom). The Wave 2 upgrade target is the **Elo 1502L FHD 15.6" (model E125496)**, commercial-grade with 5–7 year humid-bathroom lifespan, but skipped for now to ship v1 cheap. If the family loves it, upgrade and repurpose cocopar as a portable laptop monitor.
5. **Compute: Raspberry Pi 5 over Intel N150.** Reasoning: huge community/tutorial ecosystem, GPIO for future sensor projects, originally chose passive cooling (humidity), repurposable, easy resale. N150 only wins for heavy concurrent workloads (multi-cam AI, transcoding) which aren't on the roadmap. Both run Home Assistant fine; Pi 5 8GB has years of headroom for typical HA setups.
6. **Pi hardware: CanaKit bundle (purchased, in hand).** See hardware section below. This kit ships with an *active* cooler, which deviates from the earlier passive-cooling-for-humidity preference. Trade-off accepted for kit convenience.

### Things explicitly ruled out
- **Tablets** — battery swelling on always-on devices
- **Touch overlays / IR frames** — bezel too bulky, undermines the Frame TV look
- **OLED panels** — burn-in on static dashboard elements
- **TN panels** — washes out at off-axis viewing
- **Active-cooling Pi cases** (originally) — fan pulls humid air through components. *Reversed for v1 because of CanaKit kit contents; revisit if corrosion shows up.*
- **Intel N150 mini PC** — Pi wins on community/GPIO/repurposability for this use case
- **16GB Pi** — overkill, 8GB has plenty of headroom for HA
- **Local 35B+ LLMs on Pi or N150** — would need Mac Mini M4 Pro or RTX 3090 hardware
- **Recessed outlet** — existing outlet works in the mirror bay
- **24" monitor** — too big for the gap
- **DAKboard / MagicMirror² / Home Assistant as primary dashboard UI** — custom is the learning goal. HA may join later as a *data source*, not the UI. See "Software ladder" below.

---

## Hardware (current state)

### Display — purchased
**cocopar 15.6" 1080P FHD touchscreen portable monitor.** 90% sRGB, HDMI + USB-C, VESA-mountable, built-in speaker. Anti-glare matte protector to be added. Portrait orientation — native 1920×1080, rotated to 1080×1920 for the dashboard.

### Compute — CanaKit Raspberry Pi 5 bundle (purchased, in hand)
- Raspberry Pi 5, 8GB RAM
- 256GB PCIe NVMe SSD, **pre-loaded with Raspberry Pi OS 64-bit**
- M.2 HAT+ (NVMe carrier board)
- CanaKit Turbine Black Case
- CanaKit 45W USB-C PD power supply
- Active Cooler
- 2× display cables

**Two notes on the kit vs. the original plan:**
1. **Pre-flashed NVMe** means no microSD/Imager step. First-boot setup happens via a one-time keyboard+monitor session (enable SSH, set hostname, set WiFi). After that, headless. Less repeatable than the imager flow but acceptable for a single-device project.
2. **Active cooler in a humid bathroom** is suboptimal but acceptable for v1. Humidity exposure is intermittent (~30 min/day), modern Pi 5s thermally throttle gracefully if the fan ever fails, and a case-swap to Argon NEO 5 BRED is a $20 reversible decision. Will monitor.

### Mounting & cabling
- **Wall mount:** Mount-It! MI-203 ultra-slim VESA (0.55" wall clearance)
- **Cable management:** cord raceway. No recessed outlet — existing outlet sits in the mirror-cabinet bay.
- **Signal path:** Pi 5 micro-HDMI → cocopar HDMI; USB-C for touch input

### Depth math
Wall mount (0.55") + Pi in CanaKit Turbine Black case + NVMe HAT + cocopar monitor (~0.4") = **~1.6–2" total depth** (verify on assembly). Well within the 3–4" mirror-cabinet projection budget. If we upgrade to Elo 1502L later, depth grows ~1" but still fits.

### Still to acquire / verify
- **90° micro-HDMI adapter** — only if kit cables are straight (check on unboxing). If straight cables protrude >1" from the side of the Pi, this adapter is needed for the depth budget.
- **USB-C cable for touch input** — verify what's in the kit
- **VESA-to-Pi sandwich bracket** — to hide the Pi behind the monitor

### Humidity mitigations (lifespan strategy)
- **Keep the dashboard powered/awake during morning shower window.** A warm screen stays above dew point and condensation doesn't form on the panel surface or internal components. This is the single biggest lifespan extender.
- **Weekly microfiber wipe** of the screen to remove any residue
- **Run exhaust fan during and after showers**
- **Possible Panasonic WhisperCeiling FV-0511VQ1 exhaust upgrade (~$150)** as a separate project — high ROI for monitor lifespan and general moisture damage prevention throughout the room

---

## Smart home inventory (current state of our home)

What we actually have today, so the dashboard's smart-home ambitions are grounded in reality:

- **3× Amazon Alexa devices** — distributed around the house
- **~6× smart plugs** — used for lamps and small appliances
- **Dishwasher** — has a Bluetooth setting, integration unexplored
- **Washer / dryer** — may support smart-home connection, unverified
- **Other appliances** — possibly compatible, unverified

The footprint is light. Any Home Assistant work we do is about **future-proofing and a clean integration surface**, not controlling a deep existing smart-home stack. The dashboard surfacing "your laundry is done" or "the dishwasher cycle finished" is realistic in the near term; surfacing dozens of automations is not, because we don't have dozens of automations.

This also affects the build order: there's no pressure to integrate Home Assistant in v1. The morning briefing (calendar, todos, photos, message) doesn't depend on smart-home state at all, so HA can wait until we have a concrete reason to add it.

---

## Software stack (locked in for v1)

- **OS:** Raspberry Pi OS 64-bit (Bookworm), pre-loaded on NVMe by CanaKit. Headless after first boot, managed via SSH from laptop.
- **Display layer:** **Chromium in `--kiosk` mode**, autostarted via `~/.config/autostart` (or systemd if I outgrow that). This is the Linux equivalent of "Fully Kiosk Browser" on Android — same concept (full-screen, no UI chrome, locked to one URL), different OS.
- **App framework:** **Vite + vanilla JS/HTML/CSS for v1.** Migrate to React only when component reuse demands it.
- **Hosting model:** Vite preview build (`npm run preview`) on the Pi at boot. Chromium points at `localhost`. Add a Node/Express server only when a widget needs an API proxy.
- **Source control:** GitHub, public repo (`tmoots50/smart-home-dashboard`). Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`). Trunk-based — straight to `main` since I'm the only contributor.
- **Editor:** VS Code on laptop. Claude Code for AI pair programming.
- **Node version:** 22 LTS on both laptop and Pi.

### The software ladder (deliberate sequencing)

I'm intentionally NOT starting with a packaged dashboard framework. The order:

**Step 1 — Bare Chromium kiosk pointing at a custom Vite app.** Validates the hardware foundation (touch input, screen rotation, autostart, network resilience) without coupling to any specific framework's quirks. Once this works reliably, *any* web-based dashboard inherits the working foundation.

**Step 2 — Build my own dashboard apps** (clock → weather → calendar → photos → budget) inside the Vite app. This is the primary learning goal and the GitHub portfolio output.

**Step 3 — Optional later: evaluate DAKboard, MagicMirror², Home Assistant as supplementary tools.** Likely paths:
- **Home Assistant** — if/when I add smart home devices, run HA on the same Pi or a separate one and pull HA data into my dashboard via its REST API. HA stays as a backend; my custom UI stays as the frontend.
- **MagicMirror² modules** — possibly cherry-pick specific modules (transit, news ticker) to embed via iframe inside my dashboard.
- **DAKboard** — probably never. Subscription cost + closed system.

---

## App architecture

```
app/src/
├── widgets/         # leaf components: clock, weather, calendar, photo, message, todos
├── views/           # compositions: morning-briefing.js, evening-briefing.js, ...
├── lib/             # shared utilities: api clients, date helpers, theme tokens
└── main.js
```

- **Widgets are dumb.** They take props/data, render. No data fetching inside widgets.
- **Views compose widgets.** The morning-briefing view decides what's shown, where, and feeds widgets their data.
- **Mock data first.** Every widget gets a mock-data adapter in `lib/` before any real API. Real-data wiring is a swap, not a rewrite.
- **Tests co-located.** `widgets/clock.test.js` next to `widgets/clock.js`.

---

## Pi-specific suggestions to consider

These came out of the original research and are worth keeping in mind. Treat them as informed suggestions, not requirements — evaluate each one against the actual project as it develops.

- **SD card corruption** is moot since we boot from NVMe, but `log2ram` is worth installing as belt-and-suspenders. Chromium's cache writes are aggressive even on SSD.
- **WiFi reliability** can be flaky on the Pi's built-in antenna. Worth assigning a static IP via the router's DHCP reservation, and a USB WiFi dongle with external antenna is a good backup option if drops become a problem.
- **Remote access before mounting** — configuring SSH (key-based auth) and ideally Tailscale *before* the Pi goes on the wall avoids painful situations later. Multiple builders have been locked out after WiFi config changes and had to physically un-mount.
- **Screen rotation** behaves differently on Pi 5 + Wayland (Bookworm default) vs older X11. Wayland uses `wlr-randr`; X11 used `xrandr`. Worth knowing when configuring portrait mode.
- **Power supply** — the kit's 45W PD supply is correct for Pi 5 + NVMe + display power draw. Underpowered supplies cause silent corruption and weird crashes, so don't substitute a random USB-C charger if the kit one ever breaks.

---

## What "done" looks like (end-state vision)

The dashboard is a **personalized daily briefing** with a custom interface I can groom to look sleek and elegant. It's the first thing my wife sees in the morning while getting ready, and it tells her — at a glance — everything she needs to start the day.

### The morning briefing (primary use case)

When she walks up to the mirror, she sees:

- **Time, date, and weather** — anchored in a corner, always visible
- **Today's meetings** — her calendar for the day, color-coded, with the next event highlighted
- **Family todo list** — shared between us, what's outstanding for today and this week
- **Outstanding bills / actions / reminders** — surfaced from our financial accounts and ongoing commitments
- **A photo or two** — rotating family memories, pulled from our photo library
- **A special message from me** — daily or occasional, something I can push to the dashboard remotely
- **Headlines** — a small curated news feed (sources we both trust, no doom)
- **App launchers** — quick-tap navigation to the handful of web apps we actually use (calendar, todo, banking, etc.) for when she wants to drill into something

### AI-curated, personalized views

The dashboard is wired into our Anthropic Claude / OpenClaw instance, so our personal AI assistant can **customize views per person, per moment**. Examples:
- "Show my wife her morning view; show me my evening view"
- "It's a school holiday — surface kid activities instead of school pickup reminders"
- "She has back-to-back meetings — collapse the photo widget, expand the agenda"

The dashboard isn't a static layout. It's a canvas the AI assistant can rearrange based on context.

### Aesthetic bar

It has to look like a piece of décor, not a hobbyist gadget. Editorial-magazine restraint: generous whitespace, deliberate typography, a small palette, no visual clutter. My wife should *want* it on the wall. If it doesn't clear that bar, the project failed regardless of how well the code works.

### Future expansion (post-v1, in rough order)

- **Voice commands** via a wall-mounted microphone — "Claude, add eggs to the grocery list," "Claude, what's on my calendar?"
- **Motion-sensor wake/sleep** to extend monitor lifespan
- **Display upgrade** to commercial-grade Elo 1502L if the family loves the dashboard
- **Smart-home control surface** — lights, thermostat, locks — once Home Assistant joins the stack
- **Multi-device personalization** — the AI knows who's standing in front of the mirror (face recognition, phone proximity, or just a tap) and shows the right view

---

## Open questions / parking lot

These are *not* decided yet. When one resolves, move it to the "locked in" section above.

- **Calendar API:** Google Calendar embed (zero auth, easy) vs Google Calendar API (OAuth, more control). Lean toward embed for v1.
- **Photo source:** Google Drive sync via `rclone` to a local folder vs Google Photos API. Lean toward `rclone` — simpler, no quota issues.
- **Budget data:** manual CSV → Chart.js for v1. Plaid API is v3+ once everything else is solid.
- **Process supervision:** `pm2` vs raw `systemd` for the static-build server on the Pi. `systemd` is more "right" but pm2 is friendlier for a beginner. Defer.
- **Remote management:** Tailscale for outside-the-LAN SSH access. Worth setting up before mounting.
- **Hostname:** `dashboard.local` or something more specific? `mDNS` should make `.local` work out of the box on Bookworm.
- **Display blanking schedule:** sleep at 11pm, wake at 6am? Or motion-sensor-driven (v2)?

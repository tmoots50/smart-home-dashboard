# Followups

The dumping ground for everything that isn't on the v1 critical path. Active backlog of feature ideas, known limitations, and parking-lot items.

**What lives where:**
- [`spec.md`](./spec.md) — durable contract: what we're building, why, acceptance criteria, decision history, high-level future themes.
- [`todo.md`](./todo.md) — ordered v1 execution checklist.
- **`followups.md`** (this file) — everything else: feature backlog, ideas, limitations, parking lot. Append-only; reorganize when patterns emerge.
- [`_audits/`](./_audits/) — UI audit records over time.

**Format:** four sections. Move items between sections as priority changes. Prune "recently resolved" beyond ~10 items.

---

## Feature backlog — high priority
*(should ship in v1 or shortly after — these are blockers for the wife-test pass)*

- **Reflow for portrait 1080×1920.** The dashboard is currently designed and judged in landscape, but the cocopar runs portrait. Precondition for most other UI fixes — type sizes, gutters, density are all provisional until reflow. *Source: `_audits/2026-04-29-ui-audit.md`.*
- **Pick one morning-fold view.** The page currently scrolls roughly three full vertical screens. A wall display has no scroll affordance, so two-thirds of what's been built is invisible to anyone glancing past it. Decide what fits one portrait screen for the morning; demote the rest to a second view (evening, auto-rotated, or tap-reveal). *Source: `_audits/2026-04-29-ui-audit.md`.*
- **Stop letting the clock dominate.** `11:25 PM` is the largest element on screen, but a bathroom has other clocks. The headline slot should go to the highest-information widget — next event, Mabel status, or the daily note. Shrink the clock 30–40% and promote a content widget into the visual lead. *Source: `_audits/2026-04-29-ui-audit.md`.*
- **Bump touch targets to ≥48px (60+ ideal).** Today/Chores checkboxes read ~24px square. Apple HIG floor is 44; kiosk-research consensus for wall displays is 60+. From a wet-handed bathroom tap, 24px is miss-prone. Bump with the tap-area extending across the whole row, not just the checkbox glyph. *Source: `_audits/2026-04-29-ui-audit.md`.*

## Feature backlog — medium priority
*(post-v1, but architecturally directional — informs how v1 should be structured so they're easy to add)*

- **Time-of-day-driven views.** A "leaving the house" morning fold (weather + next event + transit alert + diaper-bag check) collapses 30s of phone-checking into one glance. The killer feature an off-the-shelf product can't ship — and the natural payoff for the Claude / OpenClaw integration already in `spec.md`. *Source: `_audits/2026-04-29-ui-audit.md`.*

## Ideas / parking lot
*(uncategorized; weighed cost vs. benefit when something else triggers re-evaluation)*

- **Commute card → Maps overlay.** When commute returns to the dashboard, tapping it should open a Maps view with alternate routes. Use case: explore Maps app integration; Caroline can see if the recommended route still wins. (Currently no commute card in the live view since weather replaced it in the time card.)
- **Calendar / Todo "See more" overlays.** Buttons exist (stubs alert "coming soon"). Real version: full-month calendar overlay; full editable todo list with view/edit/delete. Likely a single overlay component reused.
- **Coming Up source = family calendar.** Today the countdown is its own mock. Real wiring: derive from the family Google Calendar with future-dated events tagged "family" or in a dedicated family calendar.
- **Monarch Money button → Monarch view.** `?theme=light` shows a `$` button in the action bar (replaces phone). Stubbed alert. Real wiring: open Monarch in the same kiosk window or a focused overlay; show $ goals.

- **USB lavalier mic + Whisper.cpp on the Pi.** ~$30 hardware, one weekend of wiring. Closes the "I'd add this to a chore list but only my phone can type" loop — turns the wall from a display into a capture surface. Pairs with the Claude / OpenClaw integration the spec already anticipates. *Source: `_audits/2026-04-29-ui-audit.md`.*
- **Voice commands via wall mic** (broader than the lavalier idea — full conversational interface). *Migrated from `todo.md`.*
- **Motion-sensor wake/sleep** to extend monitor lifespan and reduce midnight glow. *Migrated from `todo.md`.*
- **Display upgrade to Elo 1502L FHD 15.6"** (commercial-grade, 5–7yr humid-bathroom lifespan) if the family loves the v1 build. *Migrated from `todo.md`.*
- **Smart-home control surface** — lights, thermostat, locks — once Home Assistant joins the stack. *Migrated from `todo.md`.*
- **Multi-device personalization** — face/phone-proximity → which view (morning Caroline vs. evening Tim). *Migrated from `todo.md`.*
- **Anthropic Claude / OpenClaw integration** for AI-rearranged views per person/moment. *Migrated from `todo.md`. (Note: also referenced in `spec.md` "What done looks like" — this entry is the implementation parking lot, the spec is the vision.)*
- **Postpartum-arc widget.** The dashboard knows Mabel's age in weeks; surface week-N normalcy hints (Claude-curated, midwife/pediatric sources). Pairs with a real referent for the "Halfway through" greeting. *Source: `_audits/2026-04-29-ui-audit.md` (idea #2).*

## Active limitations
*(known gaps we're living with for now — explicit accept-it-for-now decisions)*

- **Pi's LAN IP is not reservation-locked.** Currently `10.0.0.110` via DHCP lease; could rotate after a router reboot or lease expiry. Decided 2026-05-01 to skip the Xfinity DHCP reservation flow because Tailscale already provides a permanent stable address (`dashboard` / `100.123.125.112`) that works inside and outside the LAN. Revisit if: (a) we add another LAN device that needs to hit the Pi by hardcoded IP, (b) Tailscale ever has an outage that costs us real time, or (c) DHCP rotation actually shifts the IP and breaks something. Xfinity reservation requires enabling Admin Tool access in the Xfinity app first, then `http://10.0.0.1` → Connected Devices → Edit → Reserved IP.

## Recently resolved
*(last ~10 items, prune older)*

- *(none yet)*

# UI Audit Rubric

The substance of the `/ui-audit-dashboard` skill. The SKILL.md file is the workflow; this is the checklist. Edit this freely as our taste evolves — it's where new principles, references, and red flags get logged.

Each axis includes:
- **Check** — questions to ask of the artifact
- **Principles** — the underlying design rule and where it comes from
- **Common fails** — patterns to actively look for
- **Quantitative bars** — specific numeric thresholds where they exist

---

## 1. Layout & hierarchy

**Check:**
- Is there a single, unambiguous focal point? When you squint at the screen, what wins?
- Is the most globally-relevant info in the **top-left** quadrant? (Western reading order — first place the eye lands.)
- Does the visual weight match the informational importance? A decorative photo bigger than the next event is a hierarchy inversion.
- Does the layout follow a grid, or do widgets float at arbitrary offsets?
- Spatial weight — roughly 60% primary content, 30% secondary, 10% accent? Or is it a uniform tile-grid that flattens importance?
- **Density:** would removing one widget make it better? (Almost always yes for a v1 dashboard.)

**Principles:**
- **Stephen Few** (*Information Dashboard Design*): "the importance of each piece of information should be weighed relative to all others … this hierarchy ought to be considered when deciding what goes where."
- **Refactoring UI** (Wathan/Schoger): hierarchy comes from three levers — **size, weight, color**. Use them deliberately; don't let every element compete.
- **Tufte:** maximize the data-ink ratio. Every pixel that doesn't serve information is friction.
- **Gestalt grouping:** elements close together read as related. Use proximity before drawing borders or boxes.

**Common fails:**
- Uniform tile grid where every widget gets equal weight (defaults to "no hierarchy").
- The clock or weather is the loudest element by accident — they're table stakes, not the headliner.
- Decorative borders, drop shadows, or gradient backgrounds that add visual weight without adding information.
- Vertical stacking with no clear "above the fold" priority — the eye doesn't know where to land.

**Quantitative bars:**
- Cards / tiles: stick to a constrained spatial scale (e.g., 1 / 2 / 3 / 6 column-width units in a 6-col grid). No arbitrary widths.
- The headline element should be visually ~1.5–2× larger than the next-most-important element.

---

## 2. Typography

**Check:**
- How many font families are in play? More than one is a red flag for v1.
- How many distinct font sizes? More than 5 is usually too many.
- Is hierarchy achieved through size + weight + color, not just color?
- Line-height: is body text set with comfortable leading (1.4–1.6 for ambient reading)?
- Letter-spacing on display sizes (>32px): is it tightened slightly? (Default tracking is set for body text, not headlines.)
- Are numerals tabular where alignment matters (clocks, schedules, lists)?

**Principles:**
- **Refactoring UI:** constrained type scale. Pick 5–7 sizes (e.g., 12 / 14 / 16 / 20 / 24 / 32 / 48) and never deviate.
- **Refactoring UI:** weight is the sharpest hierarchy lever after size. Body 400, emphasis 500–600, headlines 700.
- **Editorial typography:** one type family for v1. Two if absolutely necessary (one display, one text — same superfamily preferred).
- **Distance reading:** at 4 ft viewing distance, the lower bound for comfortable body text is ~22–24 px (vs. ~14 px for arm's-length screens). Headlines should be ~36–48 px+.

**Common fails:**
- Body text under 18px on a wall display — pixel-counter readable, but adds cognitive load to glance.
- Hierarchy faked entirely with color (everything 16px, but in 6 different shades) — the eye can't sort it.
- Bootstrap default type stack — too utilitarian, instantly reads as "admin panel."
- Mixing serif body + sans display + monospace numerals with no system. Pick one family for v1.

**Quantitative bars:**
- Body / glance text: ≥22 px at 1080×1920 portrait
- Section headers: ≥32 px
- Headline (clock, primary metric): ≥56–80 px
- Line-height: 1.4–1.6 for body; 1.1–1.2 for display
- Type scale: ≤7 distinct sizes total

---

## 3. Color & contrast

**Check:**
- How many colors are in play, including grays? More than 8–9 distinct shades is usually too many.
- Was this designed in grayscale first, then colorized? Or was color used to *create* hierarchy (warning sign)?
- Are pure `#000` or `#FFF` used anywhere? Those are uncommon in well-designed UI — almost everything is near-black or off-white.
- Day vs. night: does the palette change after sunset? A bright dashboard at 11 PM is hostile.
- Contrast ratios on body text: at least WCAG AA (4.5:1)? At a 4 ft viewing distance, AAA (7:1) is the right target.
- Is color carrying meaning that nothing else carries? (Color-only signaling fails for colorblind viewers.)

**Principles:**
- **Refactoring UI:** "design in grayscale first, add color last." Color is a finishing tool, not a foundation.
- **Refactoring UI:** systematic palettes — 5–9 shades per hue, picked deliberately, not eyedropped from a screenshot.
- **Apple HIG / Material Design:** prefer near-black (#1A1A1A, #0F0F0F) over pure black for elevated UI. Pure black on OLED is fine; on LCD it crushes detail.
- **Tufte:** color should be earned, not assumed. Most dashboard tiles look better with a single accent than with a rainbow palette.
- **Mushroom-card aesthetic** (Home Assistant community): restrained palette, soft shadows, generous radii. The bar to clear visually.

**Common fails:**
- Bootstrap default blue + green + red traffic-light palette — looks like a corporate dashboard.
- 12 different colors across widgets because each tile picked its own.
- Pure white background — looks clinical, kills the Frame-TV mood. Off-white (#FAFAFA / warm-tinted) reads better as décor.
- No dark mode at all (the bathroom is dark at 6 AM and 11 PM — dark mode isn't optional for an ambient display).
- Colored text on colored backgrounds without checking contrast ratios.

**Quantitative bars:**
- Body text contrast: ≥7:1 (AAA) for ambient/glance reading
- Total distinct colors visible at once: ≤6, including grays
- Saturation: prefer desaturated tones (50–70% saturation max) for backgrounds and large surfaces; reserve high saturation for accents

---

## 4. Spacing & rhythm

**Check:**
- Is there a constrained spacing scale (e.g., 4 / 8 / 16 / 24 / 32 / 48 / 64), or arbitrary pixel values everywhere?
- Generous whitespace, especially around the most important elements?
- Is internal padding consistent across cards/tiles?
- Vertical rhythm — does line spacing feel related to spacing between blocks?

**Principles:**
- **Refactoring UI:** constrained scale, doubling-or-1.5x ratios. No arbitrary `padding: 13px`.
- **Refactoring UI:** start with too much whitespace, then take some away. Tight is the failure mode.
- **Editorial design:** the eye rests in negative space. A dashboard with no breathing room reads as "data dump," not "ambient display."

**Common fails:**
- Default Bootstrap card padding (16px) used uniformly — fine for an admin panel, claustrophobic on a wall.
- Inconsistent gutter widths between widgets — the grid is implied but not respected.
- Negative-space-phobic layouts that feel obligated to fill every pixel.

**Quantitative bars:**
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96 — pick a subset and stick to it
- Outer gutter on a portrait wall display: ≥48 px (it's a 15.6" screen — small margins look cramped)
- Card internal padding: ≥24 px

---

## 5. Touch & interaction

**Check:**
- Touch target size for any tap-able element: ≥60 px? (Kiosk research consensus is bigger than mobile.)
- Spacing between tap targets: ≥12 px to prevent fat-finger collisions?
- Does the dashboard have *any* hover-only affordances? Touch has no hover state.
- Visual feedback on tap (active/pressed state, brief highlight)? Without it, touch feels broken even when it works.
- Are tap-able elements visually distinguishable from non-tap-able? (Affordance — Don Norman.)
- Edge accessibility: are critical controls within easy thumb reach, or marooned in a corner that requires reaching?

**Principles:**
- **Apple HIG:** minimum 44×44 pt touch target. **Material Design:** 48dp.
- **Kiosk research consensus:** ≥20 mm on screen (~75 px at typical kiosk resolutions). Wall displays should err larger — Tim's wife isn't precision-tapping.
- **Don Norman:** affordances and signifiers. If it looks tappable, it must be tappable, and vice versa.
- **Fitts' Law:** time to acquire a target is a function of distance and size. Big targets, well-spaced, near where the user is looking.

**Common fails:**
- Web-default link sizes (~20 px tall) used as touch targets.
- Hover states styled but no equivalent active/pressed state for touch.
- Decorative elements that visually beg to be tapped but aren't interactive (false affordances).
- Critical controls in screen corners (worst Fitts' Law positions for a wall-mounted display).

**Quantitative bars:**
- Minimum touch target: 60×60 px (more generous than mobile)
- Primary CTA targets: 80×80 px
- Spacing between adjacent targets: ≥12 px (16+ ideal)
- Visible tap feedback: ≥100 ms duration

---

## 6. Information design

**Check:**
- What's surfaced vs. what could be derived from another widget? (Redundant data weakens both copies.)
- Signal-to-noise: every element answers a real question someone asked?
- Freshness: is data timestamped where staleness matters? An old message with no date reads as ambient noise.
- Empty states: what does each widget look like when there's no data? (Empty calendar today, no message, etc.)
- Loading states: graceful, or jarring blank flash?
- Error states: does the dashboard fail honestly, or pretend nothing's wrong?

**Principles:**
- **Stephen Few:** "the most important information needed to achieve one or more objectives." The objective for the morning briefing is "what does my wife need to know to walk out of the bathroom prepared." Audit every element against that.
- **Tufte:** chartjunk is decoration that adds zero information. Pie charts >4 slices, 3D effects, dual-axis charts — rule them out by default.
- **Don Norman:** map information to user mental models, not data structures. "3 hrs 12 min until next event" is a user-mental-model phrase. "14:42 next event" is a data-structure phrase.

**Common fails:**
- Showing the same data twice (clock at top + "good morning, it's 7:14" greeting).
- No timestamp on AI-generated daily content — yesterday's briefing looks the same as today's.
- Empty calendar shows blank space; should show "nothing scheduled — enjoy" or similar.
- 5-day weather forecast for a quick-glance widget (most days, today's weather is what matters).

---

## 7. Identity & character

**Check:**
- Does the dashboard feel like *this household's* dashboard, or a generic template?
- Is there room for the family — names, photos, a daily message in Tim's voice?
- Is the language editorial / human, or admin / system? ("Today" beats "Calendar Events"; "Shower's already foggy — exhaust fan on" beats "Humidity: 73%".)
- Is the photo widget an afterthought (small, in a corner) or a first-class citizen?

**Principles:**
- **Editorial design:** voice is the difference between a publication and a feed. The dashboard has a voice — what is it?
- **DinkyDash precedent** (the closest peer project): family-member cards with photos, daily AI greeting, identity baked in.
- **Refactoring UI:** photos and personal details *raise* the perceived design quality more than any other element. Use them deliberately.

**Common fails:**
- A dashboard that could belong to anyone — no names, no photos, no household-specific tone.
- Photo widget present but tiny, low-res, or poorly cropped.
- Weather copy reads like a forecast XML payload.

---

## 8. Distance readability (4 ft / 6 ft test)

**Check:**
- Step back from the screen 4 feet, then 6 feet. Can you read the primary content?
- Take a screenshot and view it at 25% and 50% scale on a desktop. The primary content should still be legible.
- Is contrast strong enough that mid-range values (grays on grays) don't disappear at distance?
- Are icons sized for distance, or sized for arm's-length mobile usage?

**Principles:**
- The cocopar sits in the bathroom. Tim's wife will glance at it from the sink (~3 ft), the shower (~6 ft), and across the room (~8 ft).
- Glance reading is fundamentally different from focused reading. The eye picks up shapes and weights, not letterforms. Big, bold, high-contrast wins.

**Common fails:**
- Body text sized for a phone in your hand, not a screen on a wall.
- Light gray on white that's "subtle" at desk distance but invisible at 6 ft.
- Tiny icons that need a second glance to identify.

**Quantitative bars:**
- Primary content (clock, next event, headline): readable at 6 ft (≥40 px effective height)
- Secondary content: readable at 4 ft (≥24 px)
- Tertiary content: readable at 3 ft (≥18 px)

---

## 9. Ambient hygiene (burn-in, day/night, brightness, motion)

**Check:**
- Are any elements completely static for hours with high contrast? (Burn-in risk on OLED; less so on LCD, but pixel-fatigue is real.)
- Does the dashboard dim or shift palette at night? (A bright-white dashboard at 11 PM is hostile to a sleepy household.)
- Is there subtle motion (photo crossfade, time tick) to confirm "the dashboard is alive," or does it look frozen?
- Conversely: is anything *too* motion-heavy? Looping animations on a wall display are exhausting peripherally.
- Refresh cadence: does anything that should change daily actually change?

**Principles:**
- **Frame TV / ambient display** philosophy: the screen should disappear into the room when not actively consulted. Bright, busy, animated interfaces fail this.
- **Cocopar is LCD**, not OLED — burn-in less acute, but still avoid hours of high-contrast static elements at fixed pixel positions.

**Common fails:**
- Same UI 24/7 with no day/night adjustment.
- Static text in identical pixel positions for 12+ hours (clock at top-right, every day).
- Background slideshow stuck on one image because the rotation broke silently.
- Spinning loaders left visible after data has loaded.

**Quantitative bars:**
- Brightness reduction at night (after sunset): -30–60% of daytime brightness
- Palette shift at night: warmer (lower color temperature, ~3000K equivalent) and lower saturation
- Photo / background rotation: every 30–120 s (slower than a TV slideshow, faster than a frame)

---

## 10. Wife test (décor bar / Frame TV vibe)

**Check (a meta-axis — synthesizes findings from 1–9 against the spec's stated aesthetic goal):**

- Could this hang on the wall in a magazine-shoot bathroom and pass for intentional?
- Or does it look like a hobbyist project ("aha, a Raspberry Pi")?
- Does the typography feel chosen, or defaulted?
- Does the palette feel curated, or whatever shipped with the framework?
- Is there one element that gives away the "DIY tech" feel? (Bootstrap pill buttons, default emoji, a debug timestamp, a console-warning Y-axis on a chart.)

**Principles:**
- **Spec line item (non-negotiable):** "aesthetic goal: Samsung Frame TV vibes — sleek, minimal, blends into the wall, doesn't look like a hobbyist gadget."
- **Editorial restraint:** generous whitespace, deliberate typography, small palette, no visual clutter. *Magazine, not SaaS dashboard.*
- The wife test is binary: pass or not-yet. There's no "kinda."

**Common fails:**
- Anything that reads as "developer dashboard" — log timestamps, semantic-version numbers, JSON-shaped data.
- Visible Bootstrap, Material, or default-Tailwind aesthetics. Even if they're functional, they signal "off-the-shelf demo" and hand the wife a reason to say no.
- Ironic or technical humor in copy. (No, the dashboard should not say "404 ideas not found.")
- Emoji as load-bearing UI (one decorative emoji is fine; emoji-as-icons reads as Slack, not décor).

**Quantitative bar:** there isn't one — this is the felt quality. But if you can't honestly answer "yes, this could ship to a Dwell magazine photo shoot," the answer is "not yet."

---

## Generative idea sources (when prompting unconsidered ideas)

Pull from these in roughly this order of fit-with-spec. Tim explicitly wants the skill to surface ideas that imply **expanding the household's hardware** (Home Assistant, Hue / smart bulbs, Sonos, cameras, sensors, voice mics) — frame those with the hardware cost-benefit made explicit, so he can weigh it.

1. **`_context/ui-inspo.md` parking-lot** — modules already logged, not yet built.
2. **Editorial / print design** — newspaper masthead patterns, magazine sidebar treatments, museum wall labels, *Apartamento*-style restraint. The visual language of "intentional information at a distance."
3. **Adjacent products** — Skylight, Aura, Lenovo Smart Frame, Yoto, e-ink calendars. What do they get right? What do they fail at that this could nail?
4. **Day-in-the-life context** — morning, leaving the house, returning, evening winddown. Where does the dashboard collapse a tiny friction if it's smart about *when* it shows what?
5. **MagicMirror module ecosystem** — *concepts and inspiration*. Never recommend porting the stack.
6. **HA Mushroom / Lovelace patterns** — visual and spacing reference. If an idea would need HA as a backend, say so plainly: "this would require a Home Assistant install — worth it if X is a core use case."
7. **Hardware-expansion provocations** — "if you added Hue bulbs, the winddown view could…", "with a Sonos in the kitchen, this widget could…", "a small wall mic would unlock…". The goal is to widen the option space, not to push purchases.

Frame as questions, not prescriptions. Generate 2–3 per audit, not 8. Every hardware-expansion idea should make the cost-benefit explicit.

---

## Anti-patterns specific to smart-home-style dashboards

A short list of "if you see this, flag it loudly":

- **Dashboard-as-primary-control-surface.** Most home automation should *be automatic* — geofence, schedule, scene trigger. The dashboard's job is the *information* layer (calendar, photos, message, weather, status-at-a-glance), not "tap to toggle every lamp." Control tiles earn their place only when the action is genuinely manual (e.g., the morning "shower mode" macro, or a one-tap "all off" before leaving). A grid of always-on toggles signals "I confused the dashboard for a remote."
- **Skylight-clone trap.** A Skylight Calendar would be faster, cheaper, and prettier to deploy than a custom build. The custom build's reason to exist is to do what Skylight *can't* — household voice, AI-curated views, deeper integrations, distinctive identity, the GitHub portfolio story. If the audit can't point at one thing the dashboard does that an off-the-shelf product can't, the custom build is failing its own brief.
- **Admin-panel tells.** Tab navigation in the main view, breadcrumbs, settings-gear icons, "last updated: 2 sec ago" in 11px gray, version numbers — all signal "tool" not "décor."
- **Notification fatigue patterns.** Red badge counts on routine items, urgency colors used for non-urgent info, "you have 14 things to do." Ambient displays earn glances by being calm; alarm-everything UIs train the eye to ignore them.
- **Mock-data tells.** Lorem ipsum, "John Doe", placeholder photos, demo timestamps from years ago. If a screenshot leaves these in, the audit must call them out — they're the fastest way to make a real product look fake.

---

## How to use this rubric

- **Single living document.** This file is read at the start of every audit and edited (append-only) as principles evolve. The skill never generates a new rubric file per audit — audit *reports* are chat output, not new rubrics.
- The skill walks the rubric axis-by-axis on every audit.
- Not every axis will have findings every time — say "no findings" rather than padding.
- When a new common-fail or principle shows up, **append it to the right axis here.** New principles harden over time as the project matures; this file is how future audits inherit them.
- If a finding doesn't fit any existing axis, that's a signal to add a new axis — don't force-fit.

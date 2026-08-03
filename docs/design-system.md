# Smart Home Dashboard Design System

This is the citable front-end contract for the family wall dashboard. It records the system that exists in the codebase, not a parallel redesign. Future `FRONT-END REQUIREMENTS` comments should cite the relevant numbered section (for example, “per §8.2 Touch-floor mechanism”).

Values and behavior below are sourced from the named files and line ranges. When implementation and this document disagree, verify the implementation, fix the mismatch, and update both in the same change.

## §1. Product posture and source hierarchy

### §1.1 The interface is a wall appliance

The production surface is a portrait, touch-operated morning briefing on a wall-mounted Meswao Android tablet running Fully Kiosk Browser. Its product bar is glanceable family information, editorial restraint, and in-context interaction—not desktop app density or a collection of small controls. The project spec defines the portrait wall context and “Samsung Frame TV” aesthetic (`spec.md:9-20`), while the production composition puts the skim order directly into CSS (`app/src/styles/global.css:129-156`).

Design every primary state for:

- reading at distance, with time/weather as the hero;
- thumb operation, including wet or imprecise taps;
- a half-second scan before detailed reading;
- no browser chrome, hover dependency, or navigation that discards the briefing;
- deterministic behavior in Android WebView/Fully Kiosk.

### §1.2 Sources of truth

Use this order when requirements conflict:

1. `app/tests/qa/design-contract.js` for locked visual bands (`app/tests/qa/design-contract.js:1-45`);
2. `app/src/styles/tokens.css` and its JS mirror for design tokens (`app/src/styles/tokens.css:1-32`, `app/src/lib/theme.js:1-41`);
3. `app/src/styles/global.css` for implemented primitives, composition, and widget geometry;
4. `app/src/styles/themes-*.css` for theme-only overrides;
5. `app/src/views/morning-briefing.js` for the production composition and interaction wiring (`app/src/views/morning-briefing.js:56-145`);
6. co-located `*.fixtures.js` plus `app/src/harness/harness.js` and `app/tests/qa/*.spec.js` for supported states and measured behavior.

Do not create a screen-specific value when a token or primitive already expresses the intent. Extend the system deliberately; document new tokens, primitives, locked bands, or interaction conventions here in the same branch.

## §2. Canvas, scale, and composition

### §2.1 Design canvas

The CSS design contract is a 1080 × 1920 portrait canvas at DPR 1 with touch enabled (`app/tests/qa/devices.js:18-27`). `.briefing` is capped at 1080px, centered, and fills at least the viewport height (`app/src/styles/global.css:139-156`).

The actual Meswao CSS viewport and DPR are not assumed to equal the canvas. Production can set `?scale=` to multiply the 16px root size so every rem-based dimension scales together (`app/src/main.js:20-26`). The real device must be measured with `?probe=1`; its reported viewport, DPR, physical pixels, root size, and user agent are rendered by `app/src/main.js:31-55`. The tablet QA profile remains a placeholder until those measurements are recorded (`app/tests/qa/devices.js:29-38`).

Requirements must therefore state whether a measurement is:

- a canvas value at root 16px;
- a rem value intended to scale with `?scale=`; or
- an invariant CSS-pixel floor such as a production touch target.

Do not infer physical size from a CSS-width media query. The code explicitly uses root scaling because similarly reported CSS viewports can belong to physically different tablets (`app/src/styles/global.css:4-8`).

### §2.2 Briefing layout

The production page is one `.briefing` grid in this order:

1. slim Bible ribbon;
2. two-column hero (`time/weather/actions` + photo);
3. optional Morning Brief;
4. full-width family calendar;
5. two-column lists (`Todos` + a stack of `Groceries` and `Home`).

That DOM order is the implemented composition (`app/src/views/morning-briefing.js:68-110`). The grid uses `auto 1fr auto auto auto`, 10px inter-widget gaps, and a 16px outer inset at root 16px (`app/src/styles/global.css:137-168`). The flexible `1fr` belongs to the hero; spare height must not stretch every section equally (`app/src/styles/global.css:143-150`).

Use the established composition primitives:

- `.briefing__topbox`: two equal columns;
- `.briefing__duo`: two equal side-by-side cards;
- `.briefing__stack`: vertically stacked cards inside one duo cell;
- `.card--slim`: reduced vertical inset for a one-line ribbon.

All grid children must preserve the `min-width: 0` chain. Without it, nowrap content silently expands an `auto` minimum and widens the page (`app/src/styles/global.css:178-186`). New grids should use `minmax(0, 1fr)` for the same reason; the calendar records the shipped failure this prevents (`app/src/styles/global.css:1463-1474`).

### §2.3 Above-the-fold contract

At the 1080 × 1920 canvas, the steady-state briefing must show at least five Todo rows and five Grocery rows above the fold. The Morning Brief is an approved temporary exception because it intentionally pushes the page down until cleared or noon (`app/tests/qa/briefing-layout.spec.js:64-86`).

Do not recover vertical space by shrinking locked type, card insets, row padding, or visible controls. Adjust composition, content limits, track sizing, or dedicated scroll regions instead. The current list-card heights and nested scrollers are explicit composition constraints (`app/src/styles/global.css:2785-2801`).

## §3. Token system

### §3.1 Canonical default tokens

The default token set is declared on `:root` in `tokens.css` (`app/src/styles/tokens.css:2-32`).

| Role | Token | Default |
| --- | --- | --- |
| Page background | `--color-bg` | `#0c0c0d` |
| Primary text | `--color-fg` | `#f3f1ec` |
| Secondary text | `--color-muted` | `#8a8782` |
| Primary accent | `--color-accent` | `#c9a96a` |
| Card/panel surface | `--color-surface` | `#16161a` |
| Rules/borders | `--color-border` | `#26262b` |
| Meal/event-feed accent | `--color-event-feed` | `#d49b5e` |
| Liturgical feed accent | `--color-feast` | `#8b7bc0` |
| Display face | `--font-display` | `ui-serif, "Iowan Old Style", Georgia, serif` |
| Body face | `--font-body` | `ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", sans-serif` |
| Card radius | `--radius-card` | `20px` |
| Card elevation | `--shadow-card` | `0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.25)` |

Color roles carry meaning. `accent` is the primary interaction/emphasis hue; `event-feed` separates meals from family commitments; `feast` keeps liturgical content distinct from the warm family accent (`app/src/styles/tokens.css:13-18`, `app/src/styles/global.css:2000-2030`). Do not hard-code a new hue for an existing semantic role.

### §3.2 Spacing scale

Use the six-step rem scale from `tokens.css` (`app/src/styles/tokens.css:23-28`):

| Token | Value at root 16px |
| --- | --- |
| `--space-1` | `0.25rem` / 4px |
| `--space-2` | `0.5rem` / 8px |
| `--space-3` | `1rem` / 16px |
| `--space-4` | `1.5rem` / 24px |
| `--space-5` | `2.5rem` / 40px |
| `--space-6` | `4rem` / 64px |

The 10px briefing gap and a few tightly tuned component dimensions are intentional exceptions in `global.css`, not new general spacing tokens. Requirements should prefer token values and name any exception with its mechanism and scope.

### §3.3 CSS/JS mirror

`app/src/lib/theme.js` mirrors every default color, font, spacing, radius, and shadow token for JS consumers (`app/src/lib/theme.js:8-41`). Any default-token change must update both files. `app/src/lib/theme.test.js` parses the CSS and fails on drift (`app/src/lib/theme.test.js:7-40`).

## §4. Themes and the color-scheme rule

### §4.1 Supported themes

The automatic production pair is:

- `fun`: warm light, rounded display face, coral accent, 24px cards (`app/src/styles/themes-fun.css:4-19`);
- `cosy`: warm dark, rounded display face, peach accent (`app/src/styles/themes-cosy.css:7-19`).

`light` is a retained warm-light variant with the same core palette as `fun` and limited legacy differences (`app/src/styles/themes-light.css:1-21`). Theme styles override tokens and narrowly scoped component treatments; they do not redefine component geometry.

The production resolver follows Atlanta sunrise/sunset, with a manual toggle override that expires at the next sun event. Resolution order is manual override, then local-development `?theme=`, then automatic sun mode (`app/src/lib/theme-mode.js:1-18`, `app/src/lib/theme-mode.js:70-110`). A deployed URL’s pinned `?theme=` is ignored; preview query themes are localhost-only (`app/src/lib/theme-mode.js:62-85`).

### §4.2 Fully Kiosk/WebView force-dark prevention

This rule is load-bearing: every theme must declare its own `color-scheme`.

Android WebView/Fully Kiosk can algorithmically darken a page when the system is dark, inverting a light palette even when `data-theme` says otherwise. The document declares `<meta name="color-scheme" content="light dark">` for initial paint (`app/index.html:5-15`), the default tokens declare `color-scheme: dark` (`app/src/styles/tokens.css:3-5`), light themes declare `color-scheme: light` (`app/src/styles/themes-fun.css:4-6`, `app/src/styles/themes-light.css:6-8`), and cosy declares `color-scheme: dark` (`app/src/styles/themes-cosy.css:7-9`).

A new theme without the matching declaration is invalid. Do not use `forced-color-adjust` or ad hoc color inversions as a substitute; the page owns its palette and tells the user agent which scheme it is rendering.

### §4.3 Theme extension rule

A theme may change semantic tokens, display-face choice, weight, and explicitly decorative treatments. It must preserve:

- touch geometry;
- locked type bands and insets;
- DOM order and meaning;
- text-button hit areas that are visually transparent.

The fun theme documents the last point directly: a `.btn--text` owns a 44px hit box but must not paint that whole box as a pill (`app/src/styles/themes-fun.css:37-47`).

## §5. Type and information hierarchy

### §5.1 Families

Use `--font-body` for controls, labels, lists, and utility copy. Use `--font-display` for hero numbers, editorial headlines, and moment/detail titles. The defaults and theme override are sourced in §3.1 and §4.1.

Core implemented roles:

- Clock hero: display face, `4.5rem`, line-height 1 (`app/src/styles/global.css:1154-1169`).
- Weather hero: display face, `4rem`, line-height 1 (`app/src/styles/global.css:1184-1202`).
- Overlay title: display face, `1.9rem` (`app/src/styles/global.css:294-304`).
- Morning Brief headline: display face, `1.4rem`, line-height 1.35 (`app/src/styles/global.css:2867-2872`).
- Card title: body face, `0.75rem`, semibold, uppercase, `0.12em` tracking (`app/src/styles/global.css:44-54`).
- Standard list text: body face, `1rem`, line-height 1.3 for wrapping rows (`app/src/styles/global.css:2338-2342`, `app/src/styles/global.css:2384-2385`).
- Metadata: generally `0.68–0.85rem`, muted, often uppercase or tabular where scanning requires it; examples are calendar metadata (`app/src/styles/global.css:1599-1616`) and Morning Brief times (`app/src/styles/global.css:2909-2915`).

The hierarchy is not a license to add arbitrary sizes. Reuse a role first; if no role fits, define the semantic purpose and verify it against §10’s locked bands.

### §5.2 Truncation is explicit

Content must either wrap within a stated line limit or truncate deliberately. Never rely on accidental clipping.

- Single-line utility content uses `white-space: nowrap`, `overflow: hidden`, and `text-overflow: ellipsis` together; calendar title/subtitle is the reference (`app/src/styles/global.css:1554-1567`).
- Two-line content uses `display: -webkit-box`, `-webkit-line-clamp`, `-webkit-box-orient: vertical`, and `overflow: hidden`; stacked calendar titles are the reference (`app/src/styles/global.css:1589-1597`).
- Place the clamp on the text child, not the 44px interactive parent. Month-calendar chips explicitly encode this split (`app/src/styles/global.css:755-776`).
- Long unbroken text needs `min-width: 0` and, when wrapping is intended, `overflow-wrap: anywhere` (`app/src/styles/global.css:1932-1973`).

The QA clipping audit exempts only explicit ellipsis and line-clamp treatments; other hidden text is a failure (`app/tests/qa/measure.js:118-147`).

## §6. Surface and component primitives

### §6.1 Card

`.card` is the visual unit for widgets: semantic surface, 1px border, token radius/elevation, and `16px 24px` padding at root 16px (`app/src/styles/global.css:34-42`). `.card--slim` is the single documented reduced-inset exception at `8px 24px` (`app/src/styles/global.css:186-186`).

Use `.card__title`, `.card__header`, `.card__header-actions`, `.card__divider`, and `.card__row-actions` rather than creating parallel card chrome (`app/src/styles/global.css:44-68`, `app/src/styles/global.css:121-125`, `app/src/styles/global.css:188-192`).

### §6.2 Buttons

Base controls are quiet and rounded:

- `.btn`: transparent pill base;
- `.btn--add` and `.btn--icon`: 48px square visible controls;
- `.btn--text`: small uppercase text inside a minimum 44px-high hit box;
- `.action-btn`: large circular action-bar control that shrinks by width and preserves a circle with `aspect-ratio: 1`, never below 44px (`app/src/styles/global.css:81-119`, `app/src/styles/global.css:194-227`).

Icon SVGs remain visually smaller than their hit target. Icon-only buttons require an `aria-label`; the production action bar demonstrates the contract (`app/src/views/morning-briefing.js:77-83`). Do not communicate action state by hover alone; hover styles are a supplement for development, not a kiosk interaction.

### §6.3 Lists and whole-row actions

Todo and Grocery rows share `--list-row: 3.65rem`, can grow for wrapped content, and use 10px top + 10px bottom padding at root 16px (`app/src/styles/global.css:27-32`, `app/src/styles/global.css:2288-2300`, `app/src/styles/global.css:2357-2369`). Their visible checkbox is 24px; the row is the primary target and adjacent edit/delete controls own separate 44px hit boxes (`app/src/styles/global.css:69-79`, `app/src/styles/global.css:2309-2319`).

Drag handles use `touch-action: none` only while dragging so scroll does not fight reorder gestures (`app/src/styles/global.css:2261-2276`). Nested scroll lists use `overflow-y: auto`, `overscroll-behavior: contain`, `touch-action: pan-y`, and hidden scrollbars (`app/src/styles/global.css:2785-2798`).

### §6.4 Inline input and feedback

Inline list composition replaces native `window.prompt`. The text field is 48px minimum height with token insets and accent focus border (`app/src/styles/global.css:2485-2508`). Keep editing in the card; do not navigate away for lightweight data entry.

Transient feedback uses the single bottom-center `.toast` surface with optional 44px-high action (`app/src/styles/global.css:2520-2559`). Errors and in-flight actions on the wall must resolve to visible feedback; the check-in flow is the production reference (`app/src/views/morning-briefing.js:169-201`).

### §6.5 Overlays and drawers

Detailed tasks stay over the briefing. `.overlay` supplies the fixed scrim, blur, z-index, and centered panel; `.overlay__panel` supplies token surface chrome and a constrained viewport scroller (`app/src/styles/global.css:258-293`). The generic close button is 48px square (`app/src/styles/global.css:305-318`).

Panels must use dynamic viewport units after a fallback because Android kiosk browsers can resolve `vh` against the largest retracted-system-bar viewport. The base panel declares `88vh` then `88dvh` (`app/src/styles/global.css:276-283`); full calendar/article surfaces use the same fallback pattern (`app/src/styles/global.css:642-650`, `app/src/styles/global.css:800-809`).

Modal markup uses a dialog role and accessible label; Spotify and month calendar are references (`app/src/widgets/spotify-drawer.js:13-29`, `app/src/widgets/month-calendar.js:144-147`). Standard close paths are visible close/back control, scrim tap, and Escape; the month-calendar implementation documents and implements them (`app/src/widgets/month-calendar.js:18-22`, `app/src/widgets/month-calendar.js:352-362`). When the overlay opens, apply `html.has-overlay` so the page behind it does not scroll (`app/src/styles/global.css:258-263`).

## §7. Color semantics and states

### §7.1 State is more than color

Use hue as a glanceable secondary cue, not the only state indicator. Implemented examples pair color with:

- fill plus checkmark plus strikethrough for completed list items (`app/src/styles/global.css:2320-2342`);
- left-edge treatment plus label/position for work and next calendar events (`app/src/styles/global.css:1526-1547`);
- switch-knob position plus border/icon tint for Home device state (`app/src/styles/global.css:1111-1152`);
- dashed edge plus person hue for work events in compact month cells (`app/src/styles/global.css:778-785`).

Use muted text for secondary information, not for primary actionable copy. Reserve red-like values for exceptional/negative state such as overdue, jammed, or heavy traffic; do not introduce them as decoration (`app/src/styles/global.css:994-1012`, `app/src/styles/global.css:2343-2349`).

### §7.2 Calendar identity

The established people/feed hues are:

- Tim: `--color-accent`;
- Family: `#6dac8e` sage;
- Caroline: `#6e8faf` blue;
- Catholic/liturgical: `--color-feast` violet;
- work-source edge: `#8e99a8` slate.

These assignments are consistent across person headings/chips (`app/src/styles/global.css:568-604`), calendar columns (`app/src/styles/global.css:1541-1544`), and work rows (`app/src/styles/global.css:1526-1535`). Preserve identity across new calendar views.

## §8. Touch and interaction contract

### §8.1 Minimum targets

Every interactive element must measure at least 44 × 44 CSS px. The shared audit inspects `button`, links, inputs, selects, and `[role="button"]` by default (`app/tests/qa/measure.js:25-53`). Forty-four is the enforced floor; 48px or larger is preferred for distance and touch. Home controls intentionally use 54px or larger for wet-handed operation (`app/src/styles/global.css:913-916`, `app/src/styles/global.css:1023-1035`).

A requirement should identify the tappable unit: button, whole row, full card, or transparent wrapper. “Make the icon 44px” is not an acceptable requirement unless the icon itself is intentionally the visible control.

### §8.2 Touch-floor mechanism

Meet a touch floor by enlarging the hit area, never by inflating the visual, shrinking type, or stripping spacing. Approved mechanisms are:

- make the whole row the target;
- use row/button padding;
- place a modest glyph inside a transparent 44–48px control;
- use a transparent wrapper whose hit rect does not overlap adjacent actions.

The design-contract source states this rule directly (`app/tests/qa/design-contract.js:8-15`), and Todo checkboxes demonstrate a 24px visual carried by the row (`app/src/styles/global.css:2309-2319`). Calendar navigation demonstrates the valid exception where the 44px visible pill is intentionally the control (`app/src/styles/global.css:1734-1771`).

### §8.3 Scroll and gesture ownership

The page remains vertically touch-scrollable in kiosk mode; kiosk CSS hides the scrollbar and disables pull-to-refresh bounce rather than applying `overflow: hidden` (`app/src/styles/global.css:20-25`). A component may own a nested scroll only when its height is deterministic and the gesture stays contained. Use the established scroller chain: `min-height: 0`, `overflow-y: auto`, `overscroll-behavior: contain`, `touch-action: pan-y`, hidden scrollbar (`app/src/styles/global.css:626-637`).

QA must exercise touch scroll, not only wheel input. The helper uses Chromium CDP with `gestureSourceType: 'touch'` (`app/tests/qa/measure.js:149-164`).

### §8.4 Interaction semantics

Use semantic `<button>` and `<a>` elements. Use `[role="button"]` only when native semantics cannot fit. Icon-only controls need accessible names; dialogs need a dialog role and label. Event delegation through `data-*` action attributes is an established implementation pattern, provided the harness mounts the same delegation as production (`app/src/views/morning-briefing.js:204-240`, `app/src/harness/harness.js:66-110`).

Motion must not carry required meaning. Reduced-motion support currently disables the voice/Spotify looping animations (`app/src/styles/global.css:497-499`); any new essential or repeated motion needs an equivalent `prefers-reduced-motion` treatment.

## §9. Kiosk and WebView constraints

### §9.1 Viewport and system bars

Keep `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` (`app/index.html:4-5`). Use dynamic viewport units for bounded panels as specified in §6.5. Avoid assumptions based on browser chrome appearing or disappearing; production has no useful chrome.

### §9.2 Scrollbars and overscroll

Hidden scrollbars are visual restraint, not disabled scrolling. `html.kiosk` hides scrollbar chrome and blocks vertical overscroll bounce while retaining page touch scroll (`app/src/styles/global.css:20-25`). Dedicated horizontal strips may scroll with `overscroll-behavior-inline: contain`; weather is the reference (`app/src/styles/global.css:1241-1263`).

### §9.3 Root scaling

Prefer rem dimensions for UI that should scale together under `?scale=`. Do not convert canvas CSS pixels to physical pixels by guesswork. Use `?probe=1`, record a real profile, and validate there (§2.1).

### §9.4 WebView theming

The color-scheme rule in §4.2 is mandatory. A correct light palette that omits `color-scheme: light` is still a production bug because the WebView can force-dark it.

### §9.5 Layout mechanism over padding patches

Common kiosk failures are browser mechanisms:

- `min-width: auto` expands a grid track;
- `vh` resolves against hidden system-bar space;
- content-driven flex children refuse to become scrollers without `min-height: 0`;
- an entrance transform changes measured geometry mid-animation;
- `overflow: hidden` on the root freezes content below the fold.

The implemented fixes are documented at `app/src/styles/global.css:178-184`, `app/src/styles/global.css:276-283`, `app/src/styles/global.css:626-637`, `app/tests/qa/measure.js:166-172`, and `app/src/styles/global.css:20-25`. Diagnose the mechanism before changing pixels.

## §10. Locked visual bands

### §10.1 Contract values

The canvas-only design contract locks bands, not exact values (`app/tests/qa/design-contract.js:13-16`).

| Role | Selector | Allowed contract | Current implementation |
| --- | --- | --- | --- |
| Checkbox visual | `.todos__check, .groceries__check` | width and height each 20–32px | 24 × 24px (`app/src/styles/global.css:2309-2318`, `app/src/styles/global.css:2371-2379`) |
| List-row vertical padding | `.todos__item, .groceries__item` | top + bottom ≥20px | 10 + 10px (`app/src/styles/global.css:2288-2297`, `app/src/styles/global.css:2359-2366`) |
| Standard card inset | `.card:not(.card--slim)` | every side ≥12px | 16px vertical / 24px horizontal (`app/src/styles/global.css:36-42`) |
| List text | `.todos__text, .groceries__text` | 14–18px | 16px (`app/src/styles/global.css:2341-2342`, `app/src/styles/global.css:2384-2385`) |
| Calendar title | `.calendar__title` | 12–16px | 15.2px / `0.95rem` (`app/src/styles/global.css:1554-1560`) |
| Card title | `.card__title` | 11–14px | 12px / `0.75rem` (`app/src/styles/global.css:44-53`) |
| Pick title | `.pick__title` | 14–18px | 16px / `1rem` (`app/src/styles/global.css:2763-2772`) |

The machine-readable selectors and values live at `app/tests/qa/design-contract.js:16-45`; `auditDesignContract` measures computed geometry and type (`app/tests/qa/measure.js:73-116`).

### §10.2 Change control

Moving a band requires Tim’s explicit approval recorded in the commit message. Do not alter the audit to make an unapproved design pass. Bands are enforced only on the 1080px canvas today because `?scale=` changes rem-derived computed pixels; a future tablet profile needs explicit scale-adjusted bands (`app/tests/qa/design-contract.js:13-15`, `docs/qa-harness.md:121-138`).

## §11. Component architecture

### §11.1 Widgets render; views compose

The project uses vanilla JS render/mount functions. Leaf widgets render data they receive; the view selects sources, places slots, and wires cross-widget actions. `morning-briefing.js` imports widget mounts separately from data adapters (`app/src/views/morning-briefing.js:1-35`) and then composes/mounts them (`app/src/views/morning-briefing.js:56-145`).

A new widget must not fetch from inside its render path. Add a mock/data adapter under `app/src/lib/`, keep initial and live data swappable, and let the view compose it. The production sources commonly expose `{ initial, live }`, allowing a deterministic first paint before live replacement; the mount wiring shows that pattern for Todos, Groceries, photos, and Home (`app/src/views/morning-briefing.js:133-145`).

### §11.2 Existing primitives before new patterns

Before introducing markup or CSS, check for:

- card/header/divider primitives (§6.1);
- button and action-bar primitives (§6.2);
- list row/input/toast patterns (§6.3–§6.4);
- overlay/dialog chrome (§6.5);
- semantic state colors (§7);
- production grid primitives (§2.2).

A new pattern is justified only when those primitives cannot express the interaction without semantic or layout distortion. Add the pattern to this document with source provenance.

## §12. Fixture contract

### §12.1 Required state coverage

Every UX-touching widget with state or interaction requires a co-located `app/src/widgets/<widget>.fixtures.js`. Cover, as applicable:

- empty;
- single/minimal;
- typical;
- overflow/dense;
- unlinked/unconfigured;
- loading, error, stale, or unavailable;
- long text and unbroken text;
- state-specific interaction edges.

The calendar fixture file demonstrates empty, unlinked, single, typical, overflow, work-dense, long-title, all-day pile-up, missing-meal, and adjacent-window states (`app/src/widgets/calendar.fixtures.js:1-11`, `app/src/widgets/calendar.fixtures.js:58-161`, `app/src/widgets/calendar.fixtures.js:163-219`).

### §12.2 Browser-safe and deterministic

Fixtures are imported by both the browser harness and Node-side Playwright specs. They must contain no Playwright imports and no `import.meta.env` (`app/src/widgets/calendar.fixtures.js:1-11`). Build relative dates at module load only with the expectation that QA installs its fixed clock before navigation; calendar records this contract explicitly (`app/src/widgets/calendar.fixtures.js:8-21`). Reuse mock adapters where useful rather than copying production-shaped data by hand.

Do not fetch from a harness mount. Harness states are fixture-only so renders remain deterministic (`app/src/harness/harness.js:12-14`).

## §13. QA harness contract

### §13.1 Harness trio

Every applicable widget change ships with all three:

1. `app/src/widgets/<widget>.fixtures.js` exporting `states`;
2. a `WIDGETS` entry in `app/src/harness/harness.js`;
3. `app/tests/qa/<widget>.spec.js`.

The harness loader requires a co-located fixture and production-faithful mount (`app/src/harness/harness.js:1-14`). A mount must copy the same wrappers and event delegation as `morning-briefing.js`; calendar’s mount is the reference (`app/src/harness/harness.js:66-110`). If the harness simplifies away the production wrapper, scroll owner, or delegated event, its geometry is not evidence.

### §13.2 Per-state assertions

For every fixture state, assert:

- no horizontal document overflow;
- all relevant touch targets meet the 44px floor;
- no accidental text clipping;
- design-contract bands on the 1080px canvas;
- zero console/page errors;
- a screenshot artifact on a full/artifact run.

Calendar’s state loop implements that exact sequence (`app/tests/qa/calendar.spec.js:20-44`). Add explicit behavior tests for taps, scrim/close paths, nested scroll, paging, expansion, and any state transition; examples follow at `app/tests/qa/calendar.spec.js:68-101` and `app/tests/qa/calendar.spec.js:145-188`.

### §13.3 Determinism

QA uses geometry and behavior, not screenshot diffs. Playwright runs with no retries, fixed device projects, and retained failure traces (`app/playwright.config.js:1-27`). Before geometry reads:

1. install the fixed page clock;
2. navigate;
3. call `freezeMotion(page)`;
4. wait for `html[data-harness-ready]`.

Calendar’s `open` helper is the reference (`app/tests/qa/calendar.spec.js:11-18`). Motion must be frozen because transforms alter `getBoundingClientRect` during entrance animations (`app/tests/qa/measure.js:166-172`). Screenshots are review artifacts, never golden pass/fail baselines (`app/tests/qa/measure.js:174-185`).

### §13.4 Composition QA

Isolated widgets do not prove the wall composition. Any change affecting heights, ordering, shared tracks, or above-fold content must also exercise `briefing-layout.spec.js`. That spec checks calendar/duo ordering, no page-width regression, full-composition clipping and design bands, non-reflowing overlay sheets, above-fold list rows, and action-bar targets (`app/tests/qa/briefing-layout.spec.js:17-42`, `app/tests/qa/briefing-layout.spec.js:45-119`).

## §14. Verification and shipping

From `app/`, run:

```sh
npx vitest run
npm run qa
npm run build
```

The script definitions are in `app/package.json:6-14`; Node 22+ is required (`app/package.json:23-25`). `npm run qa` runs the full Playwright suite and writes artifacts. `qa:gate` runs fast assertions without artifacts; `qa:ship` runs assertions and refreshes artifacts (`app/package.json:10-14`, `app/tests/qa/measure.js:174-184`).

For any `app/` change, visually inspect every touched widget artifact plus `briefing-layout` before shipping. Geometry proves measurable constraints, not taste. The artifact and sign-off procedure is documented at `docs/qa-harness.md:140-156`.

A docs-only change does not require visual QA, but provenance must be checked against current line numbers and the document must contain no claims unsupported by the named source.

## §15. Front-end requirements citation checklist

A developer-ready `FRONT-END REQUIREMENTS` comment should cite this document and specify:

1. **Placement:** production slot/grid and ordering (§2).
2. **State set:** empty, typical, overflow, error/unavailable, and edge cases (§12).
3. **Tokens and roles:** color, spacing, type, radius/elevation (§3–§5).
4. **Primitive:** existing card/button/list/overlay pattern or an explicit system extension (§6, §11).
5. **Touch:** tappable unit and measured floor; hit-area mechanism, not only visual size (§8).
6. **Content behavior:** wrap/clamp/ellipsis and overflow owner (§5.2, §8.3).
7. **Kiosk behavior:** root scale, dynamic viewport, color-scheme, and WebView constraints when relevant (§4, §9).
8. **Locked bands:** all affected selectors and whether Tim’s approval is required (§10).
9. **Harness:** fixture states, WIDGETS mount, per-state geometry, touch interactions, and composition checks (§12–§13).
10. **Acceptance evidence:** exact viewport/profile, tests, artifacts, and preview handle (§13–§14).

If a requirement cannot name the component, state, geometry, interaction, and evidence, it is not ready for implementation.

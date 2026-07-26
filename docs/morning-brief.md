# Morning Brief — composition contract & architecture

The Morning Brief is the one *editorial* card on the wall: Hermes's daily
judgment, not a data feed. Hermes composes it every morning (~7:30a ET) and
POSTs it to `/api/brief`; the `daybrief` widget renders it above the Family
Calendar (pushing it down) until it's cleared, replaced, or noon arrives.

Approved by Tim 2026-07-26 (letter flavor, beat-reporter voice, emojis).
This doc is the contract between the dashboard (rendering) and the Hermes
skill `morning-briefing` in `hermes-setup` (composition). Tim iterates on the
brief by giving Hermes instructions — when those change *composition* (voice,
cadence, sections), update the skill AND this doc; when they change
*rendering*, the payload contract here is the line neither side crosses
silently.

## Data flow

```
Hermes cron (7:30a, Old Mac)                     Cloudflare Pages
  mfb-calendar-show (4 cals, work = busy shape)    /api/brief (functions/api/brief.js)
  gtask todos|groceries                    POST →    normalizeBrief clamps + validates
  vault reference/household/*.md                     KV: CURATED namespace, key brief:latest
  weather (open-meteo)                             ↓ GET (widget polls every 5 min)
    → compose payload (this contract)            daybrief widget (letter flavor default)
```

## Payload

```jsonc
{
  "date": "2026-07-27",          // REQUIRED, YYYY-MM-DD local — widget only renders it on this day
  "headline": "…",               // ≤160 chars; the widget headline, ≤8-ish words
  "bodyTitle": "🗞️ Headlines",  // optional label over the prose column
  "body": ["…", "…"],           // ≤6 paragraphs ≤600 chars — the Headlines prose
  "sections": [                  // ≤8 sections; empty sections are dropped
    { "kind": "today", "title": "🗓️ Today",
      "items": [ { "time": "Morning", "text": "…" } ] }   // ≤8 items, text ≤300
  ],
  "closer": "…"                  // ≤240 chars; dry one-liner, italic footer
}
```

- The server stamps `generatedAt`; don't send it.
- **Always send both `body` and `sections`** — the flavor (letter/columns/
  split/agenda) is chosen wall-side, so a payload must render well in any.
- The only markup is `**bold**`; everything else renders as literal text.
- Unknown section `kind`s render generically off `title` — Hermes can invent
  a section without a frontend deploy.

## Composition contract (the Hermes skill enforces this)

**Scope & audience.** Personalized for Tim; household operations and family
events/planning only. Work calendar appears as busy-shape ("meetings stack
10–2"), never titles.

**Headline.** One short line, ≤8-ish words, fragment pairs welcome:
"Clear morning, stacked afternoon. One decision pending."

**Headlines (`body`).** Beat-reporter paragraphs, each exactly one shape:
content-matched emoji, **bold lede sentence**, then 1–2 supporting sentences.
Complete sentences, contractions, judgment attached to real facts. Dry humor
only where a fact supports it; never forced. 2–4 paragraphs on a normal day.

**Day-of-week readahead.** Monday (and Sunday) lead with the week's story;
Friday looks at the weekend; midweek stays on today. Depth follows the day.

**Section items are clipped phrases, not sentences** (added 2026-07-26 after
the first wall morning: long rail items wrapped 3–4 lines and swamped the
card). Target ≤60 characters — "Low: baby powder, Barebells — weekend run",
not a witty paragraph. Wit lives in Headlines and the closer ONLY. The API
hard-truncates item text at 160 chars as a backstop, mid-sentence, so
overlong items look broken by design — stay under the target.

**Sections** — fixed order, hard caps, emoji in every title:
| kind       | title              | cap | notes |
|------------|--------------------|-----|-------|
| `today`    | 🗓️ Today          | 1–5 | key events; "Morning"/"Afternoon", never "a.m." |
| `attention`| ⚖️ Needs a decision| 1–2 | only genuine decisions |
| `meals`    | 🍽️ Meals          | 1–2 | "running low on…" / "what's for dinner?" (Instacart later) |
| `todos`    | ✅ Worth doing     | 1–2 | judgment picks, not the whole list |
| `comingup` | 🔭 Coming up       | ≤4  | **cadence: Sun/Mon/Thu only**, or any day something is urgent |
| `errands`  | 🚗 On your way home| ≤3  | only on days with an actual stop |
| `mabel`    | 🍼 Mabel           | 1   | only when something is live |

Sections that have nothing to say are omitted — a short card on a quiet day
is the feature, not a bug.

**Closer.** One dry line, usually weather- or situation-aware, italic footer.
Skip it when nothing presents itself.

## Rendering (dashboard side)

- Widget: `app/src/widgets/daybrief.js` — flavors `letter` (wall default,
  Tim's pick) / `columns` / `split` / `agenda`; `?brieflavor=` overrides and
  persists (`daybrief:flavor`), mirroring `?calflavor=`. Letter layout:
  Headlines full-width on top, sections in two balanced columns below
  (reworked 2026-07-26 — the original side-by-side grid over-wrapped on
  the wall).
- Visibility: `date` must equal today, before noon, not cleared. Clearing
  (✓ → Undo toast) stores the brief's date in `daybrief:dismissed:v1`
  (kiosk-local), so yesterday's clear never hides today's brief.
- No mock in production: no blob → hidden card (`lib/daybrief.js`; contrast
  the picks fallback chain).

## Dev controls

- **Preview page** (dev-only, never bundled):
  `/daybrief-preview.html?state=real-monday&flavor=letter&theme=fun` —
  states from `daybrief.fixtures.js`, all flavors/themes, frozen 8:15a clock.
- **QA harness**: `/harness.html?widget=daybrief&state=…&flavor=…`.
- **Manual post/inspect**: `dash-brief publish < payload.json` and
  `dash-brief current` from the Old Mac (hermes-setup `deploy/bin/`).
- Fixtures `real-monday` / `real-tuesday` are the voice reference — composed
  from Tim's actual week of Jul 27 and approved by him. Keep them current
  when the voice evolves.

## Tests

- `functions/_lib/brief-api.test.js` — normalize/clamp/reject rules.
- `src/widgets/daybrief.test.js` — flavors, bold-markdown safety, visibility
  (date/noon/dismissal) rules.
- `tests/qa/daybrief.spec.js` — geometry across every state and flavor,
  hidden-when-empty, 44px clear control, bold-lede contract, Coming Up
  cadence, clear/undo behavior.

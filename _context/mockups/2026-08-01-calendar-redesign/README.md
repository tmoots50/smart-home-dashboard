# Calendar redesign mockups — 2026-08-01

Interactive HTML mockups from the dinner-lane + Coming-Up-merge design round
(session "calendar widget improvements"). Tim reviewed these as live URLs and
picked: dinner lane ON TOP of the all-day band, all-day band 2×, pills strip,
and **expand-over** (the card grows over the duo below — plate 1 of v2).

- `calendar-redesign-v2-interactive.html` — final round. Plate 1 = shipped
  design; **plate 2 = the SAVED ALTERNATIVE** (expanding swaps the panel in
  over the hour grid, card footprint fixed) in case Tim wants to switch back.
- `calendar-redesign-v1-plates.html` — first round (teaser-sentence strip,
  dinner lane below the band, fold diagram).

To view: serve this directory with a `styles` symlink to `app/src/styles`
(`ln -s ../../../app/src/styles styles && python3 -m http.server`). The pages
link `styles/{tokens,global,themes-fun}.css` relatively.

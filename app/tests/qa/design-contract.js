// The design contract: locked visual BANDS for the handful of values agents
// have historically broken (2026-07 density regression: checkboxes inflated
// to meet the 44px tap floor, padding stripped to claw the space back, fonts
// shrunk until text clipped). Bands, not exact pixels — style can evolve
// inside a band; moving OUTSIDE a band requires Tim's explicit OK, recorded
// in the commit message.
//
// The rule these numbers encode: touch floors are met with HIT AREAS
// (row/button padding, transparent boxes), never by inflating the visible
// element or stripping breathing room. See docs/qa-harness.md § Design
// contract.
//
// Measured at the 1080×1920 canvas profile only (DPR 1, root 16px) —
// auditDesignContract is a no-op elsewhere; the future tablet profile needs
// scale-adjusted bands (followups.md).
export const contract = {
  // Visual checkbox boxes (spans — the ROW holds the tap floor, not these).
  // Current: 1.5rem = 24px.
  checkbox: {
    selector: '.todos__check, .groceries__check',
    size: [20, 32],
  },

  // Row breathing room — the exact thing the regression stripped to zero.
  // Vertical padding (top+bottom) on list rows. Current: 16px + 16px = 32.
  rowPadding: {
    selector: '.todos__item, .groceries__item',
    minVerticalPadding: 20,
  },

  // Cards never lose their inset. Current: 16px vertical / 24px horizontal.
  // .card--slim (the one-line Bible verse strip) is a designed exception.
  cardPadding: {
    selector: '.card:not(.card--slim)',
    minPadding: 12,
  },

  // Type roles stay inside readable-at-arm's-length bands (px @ root 16).
  fontRoles: [
    { role: 'list text', selector: '.todos__text, .groceries__text', size: [14, 18] },      // now 16
    { role: 'calendar title', selector: '.calendar__title', size: [12, 16] },               // now 15.2
    { role: 'card title', selector: '.card__title', size: [11, 14] },                       // now 12
    { role: 'pick title', selector: '.pick__title', size: [14, 18] },                       // now 16
  ],
};

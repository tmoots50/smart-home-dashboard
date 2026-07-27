// Shared inline SVG glyphs for dashboard chrome. Centralized so a glyph used in
// more than one place stays identical: the calendar icon appears in BOTH the
// action bar (the month-calendar launch button) and the Family Calendar card's
// month-view control — they open the same overlay and must look the same.

export const SVG_ATTRS = 'viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

export const CAL_SVG = `<svg ${SVG_ATTRS}><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="3" y1="9" x2="21" y2="9"/><circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none"/></svg>`;

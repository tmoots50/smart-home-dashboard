// Shared inline SVG glyphs for dashboard chrome. Centralized so a glyph used in
// more than one place stays identical.

export const SVG_ATTRS = 'viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

// Month-view control on the Family Calendar card. (Until 2026-07-27 this also
// sat in the action bar; that slot now hosts the check-in clipboard.)
export const CAL_SVG = `<svg ${SVG_ATTRS}><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="3" y1="9" x2="21" y2="9"/><circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none"/></svg>`;

// Action-bar check-in button: ask Nigel for a time-of-day update on the wall.
export const CLIPBOARD_SVG = `<svg ${SVG_ATTRS}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>`;

// Down chevron for the Coming-Up strip toggle. A true glyph (not the U+2304
// arrowhead, which renders small and sits high in its box) so it centers
// cleanly in the 44px circle; CSS rotates it 180° when the sheet is open.
export const CHEVRON_DOWN_SVG = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

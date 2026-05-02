// Design tokens. JS source for any code that needs token values directly
// (e.g. inline SVG fill, canvas, computed style decisions).
//
// MIRROR of the CSS custom properties in src/styles/tokens.css.
// If you change a value here, change it there too — and vice versa.
// Drift is caught by lib/theme.test.js.

export const color = {
  bg: '#0c0c0d',
  fg: '#f3f1ec',
  muted: '#8a8782',
  accent: '#c9a96a',
  surface: '#16161a',
  border: '#26262b',
  'event-feed': '#d49b5e',
  'event-nurse': '#c97a8a',
  'event-pee': '#6e8aa3',
  'event-poop': '#8a6e4f',
  'event-diaper': '#6e8aa3',
};

export const font = {
  display: 'ui-serif, "Iowan Old Style", Georgia, serif',
  body: 'ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", sans-serif',
};

export const space = {
  1: '0.25rem',
  2: '0.5rem',
  3: '1rem',
  4: '1.5rem',
  5: '2.5rem',
  6: '4rem',
};

export const radius = {
  card: '20px',
};

export const shadow = {
  card: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.25)',
};

export const theme = { color, font, space, radius, shadow };

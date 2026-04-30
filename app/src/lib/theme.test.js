// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { color, font, space, radius, shadow } from './theme.js';

// Catches drift between lib/theme.js and styles/tokens.css.
// If a value changes in one, this test fails until the other is updated.

const tokensCss = readFileSync(
  fileURLToPath(new URL('../styles/tokens.css', import.meta.url)),
  'utf8',
);

const cssVar = (name) => {
  const m = tokensCss.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
};

describe('theme tokens stay in sync with tokens.css', () => {
  it.each(Object.entries(color))('color.%s matches --color-$0', (name, value) => {
    expect(cssVar(`color-${name}`)).toBe(value);
  });

  it.each(Object.entries(font))('font.%s matches --font-$0', (name, value) => {
    expect(cssVar(`font-${name}`)).toBe(value);
  });

  it.each(Object.entries(space))('space.%s matches --space-$0', (name, value) => {
    expect(cssVar(`space-${name}`)).toBe(value);
  });

  it.each(Object.entries(radius))('radius.%s matches --radius-$0', (name, value) => {
    expect(cssVar(`radius-${name}`)).toBe(value);
  });

  it.each(Object.entries(shadow))('shadow.%s matches --shadow-$0', (name, value) => {
    expect(cssVar(`shadow-${name}`)).toBe(value);
  });
});

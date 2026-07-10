import { test, expect } from '@playwright/test';
import { states } from '../../src/widgets/todos.fixtures.js';
import { captureArtifact, collectErrors } from './measure.js';
import { expectHarnessGeometry, expectNestedScrollContained, openHarness } from './widget-harness.js';

async function open(page, state) {
  await openHarness(page, 'todos', state);
}
for (const state of Object.keys(states)) {
  test(`todos/${state}: all items fit allotted scroll region`, async ({ page }, testInfo) => {
    const errors = collectErrors(page); await open(page, state);
    await expect(page.locator('.todos__item')).toHaveCount(states[state].length);
    await expect(page.locator('[data-action="more"]')).toHaveCount(0);
    await expectHarnessGeometry(page);
    await captureArtifact(page, `todos-${state}`, testInfo);
    expect(errors).toEqual([]);
  });
}
test('todos/typical: completed item can be unchecked and rechecked', async ({ page }) => {
  await open(page, 'typical');
  const row = page.locator('.todos__item').nth(2);
  await expect(row.locator('.todos__check--done')).toHaveCount(1);
  await row.tap();
  await expect(row.locator('.todos__check--done')).toHaveCount(0);
  await row.tap();
  await expect(row.locator('.todos__check--done')).toHaveCount(1);
});
test('todos/overflow: internal scrolling stays inside the card', async ({ page }) => {
  await open(page, 'overflow');
  await expectNestedScrollContained(page, '.todos__list');
});

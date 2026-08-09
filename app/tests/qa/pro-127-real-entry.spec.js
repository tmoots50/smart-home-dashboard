import { test, expect } from '@playwright/test';
import { FIXED_NOW } from './clock.js';
import { freezeMotion } from './measure.js';

async function openDashboard(page) {
  await page.clock.install({ time: FIXED_NOW });
  await page.route('https://api.open-meteo.com/**', route => route.abort());
  await page.goto('/?theme=light');
  await freezeMotion(page);
}

test('PRO-127 live dashboard replaces Groceries with Scrum Standup', async ({ page }) => {
  await openDashboard(page);

  const stack = page.locator('.briefing__stack');
  await expect(stack, 'the right stack is the user-facing dashboard entry point').toBeVisible();
  await expect(stack.getByRole('heading', { name: 'Scrum Standup' }), 'Scrum Standup must be visible in the live dashboard, not only the static mockup').toBeVisible();
  await expect(stack.locator('[data-slot="groceries"]'), 'Groceries must not remain mounted in the replaced module slot').toHaveCount(0);
  await expect(stack.getByRole('heading', { name: 'Home' }), 'Home remains immediately below the standup module').toBeVisible();
});

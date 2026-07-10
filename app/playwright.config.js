// Playwright config for the QA harness (tests/qa/). One project per device
// profile in tests/qa/devices.js — every spec runs at each profile.
//
// Deliberately NO pixel-diff baselines and NO retries: the suite asserts
// geometry and behavior, which are deterministic (frozen clock, fixture
// data). A retry would only hide a real flake — fail loudly instead.
import { defineConfig } from '@playwright/test';
import { profiles } from './tests/qa/devices.js';

export default defineConfig({
  testDir: 'tests/qa',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  timeout: 15_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: Object.values(profiles).map((p) => ({ name: p.name, use: p.use })),
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/harness.html',
    reuseExistingServer: true, // piggyback on a running dev server
    timeout: 30_000,
  },
});

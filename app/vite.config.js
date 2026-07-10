/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  test: {
    environment: 'happy-dom',
    // Unit tests only. Vitest's default include also matches *.spec.js, which
    // would pull the Playwright QA suite (tests/qa/) into the unit runner.
    include: ['**/*.test.js'],
  },
});

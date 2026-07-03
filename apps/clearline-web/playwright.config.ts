import { defineConfig, devices } from '@playwright/test';

// Overridable so a second app's Playwright suite (nx affected --target=e2e currently runs with
// --parallel=1, which is the only thing preventing a port clash today) can pick a different
// PLAYWRIGHT_PORT rather than colliding with this hardcoded default.
const PORT = Number(process.env.PLAYWRIGHT_PORT) || 5173;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // vite dev (not `vite preview`) is required — the MSW browser worker that backs auth only
  // starts under import.meta.env.DEV (see src/main.tsx), and there is no real backend to hit.
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});

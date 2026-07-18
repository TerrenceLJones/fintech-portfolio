import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json', 'html'],
      reportOnFailure: true,
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.stories.tsx', 'src/**/*.test.{ts,tsx}', 'src/index.ts'],
    },
    projects: [
      {
        plugins: [react()],
        test: {
          name: 'unit',
          environment: 'happy-dom',
          setupFiles: ['../../vitest.setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
        },
      },
      {
        plugins: [react(), storybookTest({ configDir: '.storybook' })],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});

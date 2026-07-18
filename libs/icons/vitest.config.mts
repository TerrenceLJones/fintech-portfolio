import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Framework-agnostic data package — tests run in plain Node, with no React
  // plugin and no DOM/jest-dom setup.
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json', 'html'],
      reportOnFailure: true,
      reportsDirectory: 'coverage',
    },
  },
});

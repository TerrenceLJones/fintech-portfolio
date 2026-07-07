import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Framework-agnostic data package — tests run in plain Node, with no React
  // plugin and no DOM/jest-dom setup.
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
    },
  },
});

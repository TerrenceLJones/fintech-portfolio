import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Pure-data package: no React, no JSX plugin. `outDir`/`entryRoot` are pinned
  // so declarations land in dist/ and never leak .d.ts back into src/.
  plugins: [
    dts({
      outDir: 'dist',
      entryRoot: 'src',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    }),
  ],
  build: {
    lib: {
      entry: fileURLToPath(new URL('src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'index',
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});

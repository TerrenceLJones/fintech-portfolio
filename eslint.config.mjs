import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    ignores: [
      '**/dist',
      '**/coverage',
      '**/node_modules',
      '**/.nx',
      '**/storybook-static',
      // Generated test artifacts — minified bundles that must never be linted (mirrors .gitignore).
      '**/playwright-report',
      '**/test-results',
      '**/blob-report',
      'specs/designs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['libs/ui/.storybook/*.ts', 'libs/ui/.storybook/*.tsx'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-exports': 'error',
    },
  },
  {
    // Classic hook rules apply wherever hooks live — including custom hooks in plain `.ts`
    // files (e.g. use-*.ts), which the component-only glob below would otherwise miss.
    // The stricter react-compiler rules (refs/purity) stay scoped to component files, so
    // this doesn't newly fail existing `.ts` hooks on rules the team hasn't adopted there.
    // Scoped to TS/JSX (not plain `.js`) so hook rules never fire on stray/generated bundles.
    files: ['**/*.{jsx,ts,tsx}'],
    // Playwright e2e isn't React — its fixture callback is named `use`, which rules-of-hooks
    // would otherwise mistake for the React `use` hook.
    ignores: ['**/e2e/**'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Component files additionally get the full recommended-latest set (refs, purity, …)
    // and react-refresh, whose only-export-components rule would misfire on `.ts` modules.
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      ...reactRefresh.configs.vite.rules,
    },
  },
  {
    files: ['**/scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
  {
    files: ['*.config.js', '*.config.cjs'],
    languageOptions: {
      globals: {
        module: 'writable',
        require: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
);

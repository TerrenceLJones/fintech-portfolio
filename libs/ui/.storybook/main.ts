import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
    '@storybook/addon-vitest',
    // @chromatic-com/storybook@5.2.1's CJS preset does a static `require('storybook/internal/core-server')`,
    // which storybook@10.4.6 only exports as ESM — that throws ERR_REQUIRE_ESM when addon-vitest loads this
    // config under Vitest. Skip it there; `storybook dev`/`build-storybook` still get the Chromatic panel.
    ...(process.env.VITEST ? [] : ['@chromatic-com/storybook']),
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};

export default config;

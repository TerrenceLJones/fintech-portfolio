import type { Preview } from '@storybook/react-vite';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
import '../src/styles.css';

const preview: Preview = {
  tags: ['autodocs'],
  parameters: {
    controls: { expanded: true },
    a11y: { test: 'error' },
  },
  decorators: [
    withThemeByDataAttribute({
      themes: { light: 'light', dark: 'dark' },
      defaultTheme: 'light',
      attributeName: 'data-theme',
      // Scoped below `<html>` so this toolbar toggle never fights AppShell's own
      // ThemeProvider, which sets `data-theme` on `document.documentElement` for real.
      parentSelector: '#theme-decorator-root',
    }),
    (Story) => (
      <div id="theme-decorator-root" className="bg-cl-bg text-cl-text min-h-24 p-6 font-sans">
        <Story />
      </div>
    ),
  ],
};

export default preview;

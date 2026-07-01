import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './theme-provider';

function ThemeToggleFixture() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme}>
      current: {theme}
    </button>
  );
}

describe('ThemeProvider / useTheme', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to light and sets data-theme on the document root', () => {
    render(
      <ThemeProvider>
        <ThemeToggleFixture />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('current: light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggles the theme and persists it to localStorage', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggleFixture />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button'));

    expect(screen.getByRole('button')).toHaveTextContent('current: dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem('cl-theme')).toBe('dark');
  });

  it('respects an explicit defaultTheme override', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeToggleFixture />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('current: dark');
  });

  it('throws when useTheme is called outside a ThemeProvider', () => {
    function Broken() {
      useTheme();
      return null;
    }
    expect(() => render(<Broken />)).toThrow(/useTheme must be used within a <ThemeProvider>/);
  });
});

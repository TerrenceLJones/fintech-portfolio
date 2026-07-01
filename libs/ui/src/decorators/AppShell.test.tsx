import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('renders its children inside the shell', () => {
    render(
      <AppShell title="Spend Dashboard">
        <div>Page content</div>
      </AppShell>,
    );
    expect(screen.getByText('Page content')).toBeInTheDocument();
    expect(screen.getByText('Spend Dashboard')).toBeInTheDocument();
  });

  it('toggles the document theme via the Light/Dark control', async () => {
    const user = userEvent.setup();
    render(<AppShell>content</AppShell>);

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SettingsNotFound } from './SettingsNotFound';

describe('SettingsNotFound', () => {
  it('renders a not-found heading and a recovery link to Personal Info', () => {
    render(
      <MemoryRouter>
        <SettingsNotFound />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Section not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Personal Info/i })).toHaveAttribute(
      'href',
      '/settings/personal',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsSectionPlaceholder } from './SettingsSectionPlaceholder';

describe('SettingsSectionPlaceholder', () => {
  it('renders the section title as a heading with the default coming-soon note', () => {
    render(<SettingsSectionPlaceholder title="Personal Info" />);
    expect(screen.getByRole('heading', { name: 'Personal Info' })).toBeInTheDocument();
    expect(screen.getByText('This settings section is coming soon.')).toBeInTheDocument();
  });

  it('renders a custom description when provided', () => {
    render(
      <SettingsSectionPlaceholder title="Billing & Plan" description="Manage your plan here." />,
    );
    expect(screen.getByText('Manage your plan here.')).toBeInTheDocument();
    expect(screen.queryByText('This settings section is coming soon.')).not.toBeInTheDocument();
  });
});

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthLayout } from './AuthLayout';

describe('AuthLayout', () => {
  it('renders the default brand hero copy alongside the form slot content', () => {
    render(
      <AuthLayout>
        <div>Form content</div>
      </AuthLayout>,
    );

    expect(screen.getByText('The finance-ops control plane for modern teams.')).toBeInTheDocument();
    expect(screen.getByText('SOC 2 Type II · 256-bit encryption')).toBeInTheDocument();
    expect(screen.getByText('Form content')).toBeInTheDocument();
    // Wordmark renders twice: once in the hero panel, once in the small-screen fallback.
    expect(screen.getAllByText('Clearline')).toHaveLength(2);
  });

  it('pins the auth shell to the light theme so a persisted dark preference never leaks in', () => {
    // A logged-out user carries whatever `data-theme` a prior authenticated session left on an
    // ancestor (in the app, that's <html>). The auth shell must re-scope itself to light, or the
    // form inputs render with dark-theme surface tokens (near-black). Rendering inside a dark
    // ancestor reproduces exactly that condition.
    const { container } = render(
      <div data-theme="dark">
        <AuthLayout>
          <div>Form content</div>
        </AuthLayout>
      </div>,
    );

    const shell = container.querySelector('[data-theme]:not([data-theme="dark"])');
    expect(shell).not.toBeNull();
    expect(shell).toHaveAttribute('data-theme', 'light');
    expect(shell).toContainElement(screen.getByText('Form content'));
  });

  it('supports overriding the hero copy and omitting the footer', () => {
    render(
      <AuthLayout
        headline="Reset your password"
        subcopy="Enter your work email and we'll send a link to reset it."
        footer={null}
      >
        <div>Form content</div>
      </AuthLayout>,
    );

    expect(screen.getByText('Reset your password')).toBeInTheDocument();
    expect(screen.queryByText('SOC 2 Type II · 256-bit encryption')).not.toBeInTheDocument();
  });
});

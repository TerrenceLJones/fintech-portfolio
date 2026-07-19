import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toast } from './Toast';

describe('Toast', () => {
  it('renders the message inside a polite status region by default (AC-01)', () => {
    render(<Toast message="10 approved" />);
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('10 approved');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('announces assertively when the role is alert', () => {
    render(<Toast message="Something failed" tone="negative" role="alert" />);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });
});

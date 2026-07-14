import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepUpAbandonedBanner } from './StepUpAbandonedBanner';

function renderBanner(onRetry = vi.fn()) {
  render(
    <StepUpAbandonedBanner
      recipientName="Acme Corp"
      recipientMasked="••4188"
      amountMinor={1_200_000}
      currency="USD"
      idempotencyKey="9d4c1b02-aaaa-4bbb-8ccc-ddddeeee0000"
      onRetry={onRetry}
    />,
  );
}

describe('StepUpAbandonedBanner', () => {
  it('shows the abandoned copy, the payment summary, and the preserved key (AC-03)', () => {
    renderBanner();
    expect(
      screen.getByText("Authentication wasn't completed. Try again to finish your payment."),
    ).toBeInTheDocument();
    expect(screen.getByText('Acme Corp · ••4188')).toBeInTheDocument();
    expect(screen.getByText('$12,000.00')).toBeInTheDocument();
    // The first 8 chars of the same idempotency key are surfaced to make "no duplicate" visible.
    expect(screen.getByText(/same key 9d4c1b02… preserved/)).toBeInTheDocument();
  });

  it('invokes onRetry when "Retry verification" is clicked', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    renderBanner(onRetry);
    await user.click(screen.getByRole('button', { name: /retry verification/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

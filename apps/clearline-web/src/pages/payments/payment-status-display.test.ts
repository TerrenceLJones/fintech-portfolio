import { describe, expect, it } from 'vitest';
import { paymentStatusDisplay } from './payment-status-display';

describe('paymentStatusDisplay', () => {
  it('shows a neutral, non-alarming message for a compliance hold (US-CW-009 AC-01)', () => {
    const display = paymentStatusDisplay('pending_review');
    expect(display.label).toBe('Pending review');
    expect(display.description).toBe(
      "This transfer is under review. We'll email you once it's complete.",
    );
    // Never leaks screening terminology.
    expect(display.description).not.toMatch(/sanction|watchlist|fraud/i);
    expect(display.isSettling).toBe(true);
  });

  it('describes a reversal with its date and keeps it terminal (AC-02)', () => {
    const display = paymentStatusDisplay('reversed', { reversedDate: 'Jun 26, 2026' });
    expect(display.description).toBe(
      'This payment was reversed on Jun 26, 2026. The funds were returned to your account.',
    );
    expect(display.isSettling).toBe(false);
  });

  it('renders a neutral "Processing" for the unrecognized-status fallback (AC-03)', () => {
    const display = paymentStatusDisplay('processing');
    expect(display.label).toBe('Processing');
    expect(display.isSettling).toBe(true);
  });

  it('keeps a pending payment in the settling state', () => {
    expect(paymentStatusDisplay('pending').isSettling).toBe(true);
    expect(paymentStatusDisplay('settled').isSettling).toBe(false);
  });
});

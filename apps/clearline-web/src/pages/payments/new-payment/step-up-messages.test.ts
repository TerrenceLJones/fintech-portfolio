import { describe, expect, it } from 'vitest';
import { ABANDONED_MESSAGE, messageForStepUpError } from './step-up-messages';

describe('messageForStepUpError', () => {
  it('distinguishes a wrong code (auth failure) from a network failure (AC-04 vs AC-07)', () => {
    expect(messageForStepUpError('incorrect')).toBe(
      "We couldn't verify your identity. Try again or use a different verification method.",
    );
    expect(messageForStepUpError('network')).toBe(
      'We lost connection during verification. Try again.',
    );
    expect(messageForStepUpError('incorrect')).not.toBe(messageForStepUpError('network'));
  });

  it('uses the expiry copy and signals a fresh code was sent (AC-06)', () => {
    expect(messageForStepUpError('expired')).toBe("That code expired. We've sent a new one.");
  });

  it('has distinct lockout copy', () => {
    expect(messageForStepUpError('locked')).toMatch(/too many/i);
  });

  it('exposes the exact abandoned-return copy (AC-03)', () => {
    expect(ABANDONED_MESSAGE).toBe(
      "Authentication wasn't completed. Try again to finish your payment.",
    );
  });
});

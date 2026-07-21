import { describe, expect, it } from 'vitest';
import type { CardDeclineReason } from '@clearline/contracts';
import {
  GENERIC_DECLINE_MESSAGE,
  cardholderDeclineMessage,
  feedDeclineLabel,
} from './decline-message-policy';

describe('cardholderDeclineMessage (the security gate — US-CW-014 AC-07)', () => {
  it('shows the specific, actionable copy for an MCC-restricted decline (AC-03)', () => {
    expect(cardholderDeclineMessage('mcc_restricted')).toBe(
      "Transaction declined — this card can't be used at this type of merchant",
    );
  });

  it('shows the specific copy for an insufficient-limit decline (AC-04)', () => {
    expect(cardholderDeclineMessage('insufficient_limit')).toBe(
      'Transaction declined — insufficient limit remaining',
    );
  });

  it('shows the specific copy for an over-per-transaction-limit decline (US-CW-038)', () => {
    expect(cardholderDeclineMessage('over_transaction_limit')).toBe(
      'Transaction declined — over the per-transaction limit',
    );
  });

  it('collapses a lost/stolen decline to the identical generic message (AC-07)', () => {
    expect(cardholderDeclineMessage('lost_or_stolen')).toBe(GENERIC_DECLINE_MESSAGE);
  });

  it('collapses a fraud decline to the SAME generic message as lost/stolen (AC-07)', () => {
    expect(cardholderDeclineMessage('fraud')).toBe(cardholderDeclineMessage('lost_or_stolen'));
  });

  it('never leaks a sensitive reason verbatim to the cardholder (AC-07)', () => {
    // The generic message must not name the true cause. This is the security-critical invariant.
    for (const reason of ['lost_or_stolen', 'fraud'] as const) {
      const message = cardholderDeclineMessage(reason);
      expect(message).toBe(GENERIC_DECLINE_MESSAGE);
      expect(message.toLowerCase()).not.toMatch(/lost|stolen|fraud|frozen/);
    }
  });

  it('does not reveal a freeze to the cardholder either — a frozen card reads generically', () => {
    expect(cardholderDeclineMessage('frozen')).toBe(GENERIC_DECLINE_MESSAGE);
  });
});

describe('feedDeclineLabel (Controller feed row reason — AC-03/AC-04)', () => {
  it('qualifies an MCC block with the merchant category', () => {
    expect(feedDeclineLabel('mcc_restricted', 'Restaurants')).toBe('MCC restricted (Restaurants)');
  });

  it('names an MCC block without a category when none is given', () => {
    expect(feedDeclineLabel('mcc_restricted')).toBe('MCC restricted');
  });

  it('labels an insufficient-limit decline for the feed', () => {
    expect(feedDeclineLabel('insufficient_limit')).toBe('insufficient limit remaining');
  });

  it('labels an over-per-transaction-limit decline for the feed', () => {
    expect(feedDeclineLabel('over_transaction_limit')).toBe('over per-transaction limit');
  });

  it('labels a security hold for the Controller feed without the redundant "declined" wording', () => {
    // Rendered as "Declined · security hold" — never "Declined · declined", and it does not name
    // lost vs stolen vs fraud (that stays server-side).
    expect(feedDeclineLabel('lost_or_stolen')).toBe('security hold');
    expect(feedDeclineLabel('fraud')).toBe('security hold');
    expect(feedDeclineLabel('lost_or_stolen')).not.toMatch(/lost|stolen|fraud/i);
  });
});

describe('CardDeclineReason exhaustiveness', () => {
  it('produces a cardholder message for every reason (no unhandled case)', () => {
    const reasons: CardDeclineReason[] = [
      'frozen',
      'mcc_restricted',
      'insufficient_limit',
      'over_transaction_limit',
      'lost_or_stolen',
      'fraud',
    ];
    for (const reason of reasons) {
      expect(cardholderDeclineMessage(reason).length).toBeGreaterThan(0);
    }
  });
});

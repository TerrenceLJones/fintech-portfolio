import { describe, expect, it, vi } from 'vitest';
import type { CardFeedMessage, IssueCardRequest, Money } from '@clearline/contracts';
import { CardsService, type CardActor } from './cards.service';

const controller: CardActor = {
  userId: 'user_ctrl',
  displayName: 'Marcus Okafor',
  permissions: ['cards:view', 'cards:manage'],
};

const viewer: CardActor = {
  userId: 'user_emp',
  displayName: 'Dara Reyes',
  permissions: ['cards:view'],
};

function usd(amountMinorUnits: number): Money {
  return { amountMinorUnits, currency: 'USD' };
}

function issueRequest(overrides: Partial<IssueCardRequest> = {}): IssueCardRequest {
  return {
    holderId: 'emp_reyes',
    monthlyLimit: usd(200_000),
    allowedMccs: ['software', 'office_supplies'],
    ...overrides,
  };
}

describe('CardsService.listCards / getCard', () => {
  it('lists the seeded wallet and derives a healthy remaining limit per card', () => {
    const service = new CardsService();
    const cards = service.listCards();
    expect(cards.length).toBeGreaterThanOrEqual(5);
    const flagship = service.getCard('card_4021');
    expect(flagship?.holderName).toBe('Dara Reyes — Design');
    // Remaining is derived, not stored: monthlyLimit − authorizedSpend.
    expect(flagship?.monthlyLimit.amountMinorUnits).toBe(200_000);
    expect(flagship?.authorizedSpend.amountMinorUnits).toBe(6_300);
  });

  it('returns undefined for an unknown card', () => {
    expect(new CardsService().getCard('card_nope')).toBeUndefined();
  });
});

describe('CardsService.issueCard (US-CW-014 AC-01)', () => {
  it('forbids a caller without cards:manage', () => {
    const service = new CardsService();
    expect(service.issueCard(issueRequest(), viewer)).toEqual({ outcome: 'forbidden' });
  });

  it('issues a card visible in the wallet and records an audit event with its limits + restrictions', () => {
    const service = new CardsService();
    const result = service.issueCard(issueRequest(), controller);
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;

    expect(service.getCard(result.card.id)).toBeDefined();
    expect(result.card.status).toBe('active');
    expect(result.card.monthlyLimit).toEqual(usd(200_000));
    expect(result.card.allowedMccs).toEqual(['software', 'office_supplies']);
    // Fresh card starts with zero authorized spend, so remaining derives to the full limit.
    expect(result.card.authorizedSpend.amountMinorUnits).toBe(0);

    const audit = service.getAuditLog().find((e) => e.cardId === result.card.id);
    expect(audit?.type).toBe('card.issued');
    expect(audit?.actorId).toBe('user_ctrl');
    expect(audit?.monthlyLimitMinorUnits).toBe(200_000);
    expect(audit?.allowedMccs).toEqual(['software', 'office_supplies']);
  });

  it('rejects a non-positive monthly limit', () => {
    const service = new CardsService();
    expect(service.issueCard(issueRequest({ monthlyLimit: usd(0) }), controller)).toEqual({
      outcome: 'invalid_limit',
    });
  });

  it('rejects an unknown holder', () => {
    const service = new CardsService();
    expect(service.issueCard(issueRequest({ holderId: 'emp_ghost' }), controller)).toEqual({
      outcome: 'invalid_holder',
    });
  });
});

describe('CardsService.setFreeze (US-CW-014 AC-05)', () => {
  it('forbids a caller without cards:manage', () => {
    const service = new CardsService();
    expect(service.setFreeze('card_4021', true, viewer)).toEqual({ outcome: 'forbidden' });
  });

  it('freezes a card and records who froze it and when', () => {
    const service = new CardsService();
    const result = service.setFreeze('card_4021', true, controller);
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    expect(result.card.status).toBe('frozen');

    const audit = service.getAuditLog().find((e) => e.type === 'card.frozen');
    expect(audit?.cardId).toBe('card_4021');
    expect(audit?.actorId).toBe('user_ctrl');
    expect(audit?.timestamp).toBeTruthy();
  });

  it('unfreezes a frozen card and audits it', () => {
    const service = new CardsService();
    const result = service.setFreeze('card_5567', false, controller);
    expect(result.outcome).toBe('ok');
    if (result.outcome !== 'ok') return;
    expect(result.card.status).toBe('active');
    expect(service.getAuditLog().some((e) => e.type === 'card.unfrozen')).toBe(true);
  });

  it('returns not_found for an unknown card', () => {
    expect(new CardsService().setFreeze('card_nope', true, controller)).toEqual({
      outcome: 'not_found',
    });
  });
});

describe('CardsService.authorizeTransaction (US-CW-014 AC-02/03/04/05)', () => {
  it('approves an in-policy charge, appends it to the feed, and moves the derived remaining limit (AC-02)', () => {
    // Fresh $2,000 card, $0 spent → a $150 charge derives remaining to $1,850.
    const service = new CardsService();
    const issued = service.issueCard(issueRequest(), controller);
    if (issued.outcome !== 'ok') throw new Error('setup');
    const cardId = issued.card.id;

    const result = service.authorizeTransaction(cardId, {
      merchantName: 'Notion Labs',
      merchantInitials: 'No',
      mcc: 'software',
      mccLabel: 'Software',
      amountMinorUnits: 15_000,
    });
    expect(result.outcome).toBe('approved');
    if (result.outcome !== 'approved') return;
    expect(result.transaction.status).toBe('approved');
    expect(service.getCard(cardId)?.authorizedSpend.amountMinorUnits).toBe(15_000);
    // $200,000 − $15,000 = $185,000 remaining.
    expect(service.getBacklog(cardId).at(-1)?.merchantName).toBe('Notion Labs');
  });

  it('declines an out-of-category charge without moving the limit, tagging the reason (AC-03)', () => {
    const service = new CardsService();
    const before = service.getCard('card_4021')?.authorizedSpend.amountMinorUnits;
    const result = service.authorizeTransaction('card_4021', {
      merchantName: 'Vista Grill',
      merchantInitials: 'Vi',
      mcc: 'restaurants',
      mccLabel: 'Restaurants',
      amountMinorUnits: 6_400,
    });
    expect(result.outcome).toBe('declined');
    if (result.outcome !== 'declined') return;
    expect(result.transaction.status).toBe('declined');
    expect(result.transaction.declineReason).toBe('mcc_restricted');
    expect(service.getCard('card_4021')?.authorizedSpend.amountMinorUnits).toBe(before);
  });

  it('declines an over-limit charge (AC-04)', () => {
    // card_7712 is seeded with only $50 remaining.
    const result = new CardsService().authorizeTransaction('card_7712', {
      merchantName: 'GitHub',
      merchantInitials: 'Gi',
      mcc: 'software',
      mccLabel: 'Software',
      amountMinorUnits: 7_500,
    });
    expect(result.outcome).toBe('declined');
    if (result.outcome !== 'declined') return;
    expect(result.transaction.declineReason).toBe('insufficient_limit');
  });

  it('declines any charge on a frozen card immediately (AC-05)', () => {
    const result = new CardsService().authorizeTransaction('card_5567', {
      merchantName: 'Staples',
      merchantInitials: 'St',
      mcc: 'office_supplies',
      mccLabel: 'Office Supplies',
      amountMinorUnits: 1_000,
    });
    expect(result.outcome).toBe('declined');
    if (result.outcome !== 'declined') return;
    expect(result.transaction.declineReason).toBe('frozen');
  });

  it('records the true lost/stolen reason on a security-gated decline (AC-07)', () => {
    const result = new CardsService().authorizeTransaction('card_8830', {
      merchantName: 'Best Buy',
      merchantInitials: 'Be',
      mcc: 'office_supplies',
      mccLabel: 'Office Supplies',
      amountMinorUnits: 34_000,
      securityHold: 'lost_or_stolen',
    });
    expect(result.outcome).toBe('declined');
    if (result.outcome !== 'declined') return;
    expect(result.transaction.declineReason).toBe('lost_or_stolen');
  });
});

describe('CardsService feed pub/sub (US-CW-014 AC-02/AC-06)', () => {
  it('streams an approved authorization to a subscribed feed connection', () => {
    const service = new CardsService();
    const received: CardFeedMessage[] = [];
    service.connectFeed('card_4021', {
      send: (msg) => received.push(msg),
      close: () => {},
    });

    service.authorizeTransaction('card_4021', {
      merchantName: 'Figma Inc.',
      merchantInitials: 'Fi',
      mcc: 'software',
      mccLabel: 'Software',
      amountMinorUnits: 1_500,
    });

    const streamed = received.find((m) => m.type === 'transaction');
    expect(streamed).toBeDefined();
    if (streamed?.type !== 'transaction') return;
    expect(streamed.transaction.merchantName).toBe('Figma Inc.');
  });

  it('only notifies connections subscribed to the same card', () => {
    const service = new CardsService();
    const other = vi.fn();
    service.connectFeed('card_8830', { send: other, close: () => {} });
    service.authorizeTransaction('card_4021', {
      merchantName: 'Figma Inc.',
      merchantInitials: 'Fi',
      mcc: 'software',
      mccLabel: 'Software',
      amountMinorUnits: 1_500,
    });
    expect(other).not.toHaveBeenCalled();
  });

  it('dropFeed closes every open connection for a card (AC-06 reconnect trigger)', () => {
    const service = new CardsService();
    const close = vi.fn();
    service.connectFeed('card_4021', { send: () => {}, close });
    service.dropFeed('card_4021');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('stops notifying a connection once it unsubscribes', () => {
    const service = new CardsService();
    const send = vi.fn();
    const off = service.connectFeed('card_4021', { send, close: () => {} });
    off();
    service.authorizeTransaction('card_4021', {
      merchantName: 'Figma Inc.',
      merchantInitials: 'Fi',
      mcc: 'software',
      mccLabel: 'Software',
      amountMinorUnits: 1_500,
    });
    expect(send).not.toHaveBeenCalled();
  });
});

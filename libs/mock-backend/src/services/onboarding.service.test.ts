import { describe, expect, it } from 'vitest';
import { OnboardingService } from './onboarding.service';

const NOW = 1_700_000_000_000;
const MINUTE = 60 * 1000;
const KNOWN_EIN = '12-3456789';
const OTHER_KNOWN_EIN = '98-7654321';
const UNKNOWN_EIN = '00-0000000';

const business = (
  overrides: Partial<Parameters<OnboardingService['submitBusinessInfo']>[1]> = {},
) => ({
  legalName: 'Northwind Labs, Inc.',
  ein: KNOWN_EIN,
  structure: 'C-Corporation',
  addressLine1: '220 Mission St, Suite 400',
  city: 'San Francisco',
  state: 'CA',
  postalCode: '94105',
  ...overrides,
});

function newService() {
  return new OnboardingService();
}

describe('OnboardingService.getStatus', () => {
  it('creates a fresh in-progress record on first access', () => {
    const service = newService();
    const status = service.getStatus('user_1', NOW);

    expect(status.status).toBe('in_progress');
    expect(status.currentStep).toBe('business');
    expect(status.lastCompletedStep).toBe(null);
    expect(status.owners).toEqual([]);
    expect(status.documents).toEqual([]);
    expect(status.documentAttemptCount).toBe(0);
    expect(status.sessionTimedOut).toBe(false);
  });

  it('returns the same record for the same user on subsequent calls', () => {
    const service = newService();
    const businessId = service.getStatus('user_1', NOW).businessId;
    expect(service.getStatus('user_1', NOW).businessId).toBe(businessId);
  });
});

describe('OnboardingService.seedApprovedAccount', () => {
  it('seeds an already-approved, fully-onboarded record so the user lands in the app', () => {
    const service = newService();
    service.seedApprovedAccount('user_1', business(), NOW);

    const status = service.getStatus('user_1', NOW);
    expect(status.status).toBe('approved');
    expect(status.currentStep).toBe('review');
    expect(status.lastCompletedStep).toBe('review');
    expect(status.business).toEqual(business());
  });

  it('claims the seeded EIN so a different user onboarding it is flagged as a duplicate (AC-07)', async () => {
    const service = newService();
    service.seedApprovedAccount('user_1', business(), NOW);

    const result = await service.submitBusinessInfo('user_2', business(), NOW);
    expect(result.outcome).toBe('duplicate_business');
  });

  it('does not overwrite an existing record for the same user', async () => {
    const service = newService();
    await service.submitBusinessInfo('user_1', business({ ein: OTHER_KNOWN_EIN }), NOW);
    service.seedApprovedAccount('user_1', business(), NOW);

    const status = service.getStatus('user_1', NOW);
    expect(status.status).toBe('in_progress');
    expect(status.business?.ein).toBe(OTHER_KNOWN_EIN);
  });
});

describe('OnboardingService.submitBusinessInfo', () => {
  it('verifies a registry-known EIN and advances to the Owners step', async () => {
    const service = newService();
    const result = await service.submitBusinessInfo('user_1', business(), NOW);

    expect(result.outcome).toBe('verified');
    const status = service.getStatus('user_1', NOW);
    expect(status.business).toMatchObject({ ein: KNOWN_EIN });
    expect(status.lastCompletedStep).toBe('business');
    expect(status.currentStep).toBe('owners');
  });

  it('reports ein_not_found for an EIN the registry does not recognize, without saving or advancing', async () => {
    const service = newService();
    const result = await service.submitBusinessInfo('user_1', business({ ein: UNKNOWN_EIN }), NOW);

    expect(result.outcome).toBe('ein_not_found');
    const status = service.getStatus('user_1', NOW);
    expect(status.business).toBe(null);
    expect(status.currentStep).toBe('business');
  });

  it('reports duplicate_business when a different user already onboarded that EIN', async () => {
    const service = newService();
    await service.submitBusinessInfo('user_1', business(), NOW);

    const result = await service.submitBusinessInfo('user_2', business(), NOW);
    expect(result.outcome).toBe('duplicate_business');
  });

  it('does not treat the same user resubmitting their own EIN as a duplicate', async () => {
    const service = newService();
    await service.submitBusinessInfo('user_1', business(), NOW);

    const result = await service.submitBusinessInfo('user_1', business(), NOW + MINUTE);
    expect(result.outcome).toBe('verified');
  });
});

describe('OnboardingService.addOwner', () => {
  it('flags an owner at or above 25% ownership as requiring KYC and masks the SSN/ITIN', async () => {
    const service = newService();
    const result = await service.addOwner(
      'user_1',
      {
        firstName: 'Dara',
        lastName: 'Reyes',
        ownershipPercent: 60,
        dateOfBirth: '1986-04-12',
        ssnItin: '123-45-4417',
      },
      NOW,
    );

    expect(result.owner.requiresKyc).toBe(true);
    expect(result.owner.ssnItinLast4).toBe('4417');
    expect((result.owner as { ssnItin?: string }).ssnItin).toBeUndefined();
  });

  it('derives fullName from the first and last name parts', async () => {
    const service = newService();
    const result = await service.addOwner(
      'user_1',
      { firstName: 'Dara', lastName: 'Reyes', ownershipPercent: 60 },
      NOW,
    );

    expect(result.owner.firstName).toBe('Dara');
    expect(result.owner.lastName).toBe('Reyes');
    expect(result.owner.fullName).toBe('Dara Reyes');
  });

  it('does not require KYC below 25% ownership', async () => {
    const service = newService();
    const result = await service.addOwner(
      'user_1',
      { firstName: 'Marcus', lastName: 'Okafor', ownershipPercent: 24 },
      NOW,
    );
    expect(result.owner.requiresKyc).toBe(false);
  });
});

describe('OnboardingService.completeStep', () => {
  it('advances currentStep and lastCompletedStep in wizard order', () => {
    const service = newService();
    service.completeStep('user_1', 'owners', NOW);

    const status = service.getStatus('user_1', NOW);
    expect(status.lastCompletedStep).toBe('owners');
    expect(status.currentStep).toBe('documents');
  });
});

describe('OnboardingService.submitDocument', () => {
  it('accepts a recognized document type without incrementing the attempt counter', () => {
    const result = service().submitDocument(
      'user_1',
      { ownerId: 'owner_1', fileName: 'drivers-license-front.jpg', mimeType: 'image/jpeg' },
      NOW,
    );
    expect(result.outcome).toBe('accepted');
    expect(result.attemptCount).toBe(0);
  });

  it('reports wrong_type for an unrecognized document and increments the attempt counter', () => {
    const svc = service();
    const result = svc.submitDocument(
      'user_1',
      { ownerId: 'owner_1', fileName: 'lunch-receipt.jpg', mimeType: 'image/jpeg' },
      NOW,
    );
    expect(result.outcome).toBe('wrong_type');
    expect(result.attemptCount).toBe(1);
  });

  it('blocks further attempts after the 3rd failure and issues a support reference', () => {
    const svc = service();
    svc.submitDocument(
      'user_1',
      { ownerId: 'owner_1', fileName: 'a.jpg', mimeType: 'image/jpeg' },
      NOW,
    );
    svc.submitDocument(
      'user_1',
      { ownerId: 'owner_1', fileName: 'b.jpg', mimeType: 'image/jpeg' },
      NOW,
    );
    const third = svc.submitDocument(
      'user_1',
      { ownerId: 'owner_1', fileName: 'c.jpg', mimeType: 'image/jpeg' },
      NOW,
    );

    expect(third.outcome).toBe('blocked');
    expect(third.attemptCount).toBe(3);
    expect(third.supportReferenceId).toMatch(/^SR-/);
    expect(svc.getStatus('user_1', NOW).status).toBe('documents_blocked');
  });

  it('stays blocked without incrementing the counter further once blocked', () => {
    const svc = service();
    svc.submitDocument(
      'user_1',
      { ownerId: 'owner_1', fileName: 'a.jpg', mimeType: 'image/jpeg' },
      NOW,
    );
    svc.submitDocument(
      'user_1',
      { ownerId: 'owner_1', fileName: 'b.jpg', mimeType: 'image/jpeg' },
      NOW,
    );
    svc.submitDocument(
      'user_1',
      { ownerId: 'owner_1', fileName: 'c.jpg', mimeType: 'image/jpeg' },
      NOW,
    );

    const fourth = svc.submitDocument(
      'user_1',
      { ownerId: 'owner_1', fileName: 'passport.jpg', mimeType: 'image/jpeg' },
      NOW,
    );
    expect(fourth.outcome).toBe('blocked');
    expect(fourth.attemptCount).toBe(3);
  });

  function service() {
    return newService();
  }
});

describe('OnboardingService.submitReview', () => {
  it('approves a business with no watchlist match', async () => {
    const service = newService();
    await service.submitBusinessInfo('user_1', business(), NOW);
    const result = service.submitReview('user_1', NOW);
    expect(result.outcome).toBe('approved');
  });

  it('routes a watchlist-matching business to a neutral under_review outcome', async () => {
    const service = newService();
    await service.submitBusinessInfo(
      'user_1',
      business({ legalName: 'Vostok Trading LLC', ein: OTHER_KNOWN_EIN }),
      NOW,
    );
    const result = service.submitReview('user_1', NOW);
    expect(result.outcome).toBe('under_review');
    expect(service.getStatus('user_1', NOW).status).toBe('under_review');
  });

  it('records an approval notification event on approval (US-CW-004 AC-08)', async () => {
    const service = newService();
    await service.submitBusinessInfo('user_1', business(), NOW);
    service.submitReview('user_1', NOW);

    expect(service.getSentNotifications()).toEqual([
      expect.objectContaining({ type: 'onboarding_approved', userId: 'user_1', timestamp: NOW }),
    ]);
  });

  it('does not record an approval notification when the outcome is under_review', async () => {
    const service = newService();
    await service.submitBusinessInfo(
      'user_1',
      business({ legalName: 'Vostok Trading LLC', ein: OTHER_KNOWN_EIN }),
      NOW,
    );
    service.submitReview('user_1', NOW);

    expect(service.getSentNotifications()).toEqual([]);
  });
});

describe('OnboardingService inactivity resume', () => {
  it('resets currentStep to lastCompletedStep and flags sessionTimedOut after 30 idle minutes', async () => {
    const service = newService();
    await service.submitBusinessInfo('user_1', business(), NOW);

    const status = service.getStatus('user_1', NOW + 31 * MINUTE);
    expect(status.sessionTimedOut).toBe(true);
    expect(status.currentStep).toBe('business');
    expect(status.lastCompletedStep).toBe('business');
  });

  it('does not flag a timeout on the immediate next call once resumed', async () => {
    const service = newService();
    await service.submitBusinessInfo('user_1', business(), NOW);
    service.getStatus('user_1', NOW + 31 * MINUTE);

    const status = service.getStatus('user_1', NOW + 31 * MINUTE);
    expect(status.sessionTimedOut).toBe(false);
  });

  it('does not flag a timeout under 30 idle minutes', async () => {
    const service = newService();
    await service.submitBusinessInfo('user_1', business(), NOW);

    const status = service.getStatus('user_1', NOW + 29 * MINUTE);
    expect(status.sessionTimedOut).toBe(false);
    expect(status.currentStep).toBe('owners');
  });
});

describe('OnboardingService.snapshot / restore', () => {
  it('round-trips all state through a plain-object snapshot', async () => {
    const service = newService();
    await service.submitBusinessInfo('user_1', business(), NOW);
    await service.addOwner(
      'user_1',
      { firstName: 'Dara', lastName: 'Reyes', ownershipPercent: 60 },
      NOW,
    );

    const snapshot = service.snapshot();
    const restored = new OnboardingService();
    restored.restore(snapshot);

    expect(restored.getStatus('user_1', NOW)).toEqual(service.getStatus('user_1', NOW));
  });

  it('round-trips sent notifications through a plain-object snapshot', async () => {
    const service = newService();
    await service.submitBusinessInfo('user_1', business(), NOW);
    service.submitReview('user_1', NOW);

    const restored = new OnboardingService();
    restored.restore(service.snapshot());

    expect(restored.getSentNotifications()).toEqual(service.getSentNotifications());
  });
});

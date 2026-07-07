import { describe, expect, it } from 'vitest';
import type { OnboardingOverallStatus } from '@clearline/contracts';
import { canAccessApp, onboardingDestination } from './onboarding-routing';

describe('onboardingDestination', () => {
  it('sends a not-yet-submitted (in_progress) user to the wizard', () => {
    expect(onboardingDestination('in_progress')).toBe('wizard');
  });

  it('sends an under_review user to the status page as their default landing', () => {
    expect(onboardingDestination('under_review')).toBe('status');
  });

  it('sends a documents_blocked user to the status page', () => {
    expect(onboardingDestination('documents_blocked')).toBe('status');
  });

  it('sends an approved user to the app', () => {
    expect(onboardingDestination('approved')).toBe('app');
  });

  it('resolves every onboarding status to exactly one area', () => {
    const statuses: OnboardingOverallStatus[] = [
      'in_progress',
      'under_review',
      'approved',
      'documents_blocked',
    ];
    for (const status of statuses) {
      expect(['wizard', 'status', 'app']).toContain(onboardingDestination(status));
    }
  });
});

describe('canAccessApp', () => {
  it('admits an approved user', () => {
    expect(canAccessApp('approved')).toBe(true);
  });

  // US-CW-005 AC-05: a pending compliance review must not block non-financial areas of the product.
  it('admits an under_review user so a pending review does not gate the app', () => {
    expect(canAccessApp('under_review')).toBe(true);
  });

  it('keeps a not-yet-submitted (in_progress) user out of the app', () => {
    expect(canAccessApp('in_progress')).toBe(false);
  });

  it('keeps a hard-blocked (documents_blocked) user out of the app', () => {
    expect(canAccessApp('documents_blocked')).toBe(false);
  });
});

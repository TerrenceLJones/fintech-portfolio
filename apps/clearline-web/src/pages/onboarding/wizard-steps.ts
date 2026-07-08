import type { OnboardingStepId } from '@clearline/contracts';

/** Wizard-order labels for Stepper, and the step-id-to-path/index mapping every onboarding page and the route guard share. */
export const WIZARD_STEP_LABELS = ['Business', 'Owners', 'Documents', 'Review'];

export const WIZARD_STEP_ORDER: OnboardingStepId[] = ['business', 'owners', 'documents', 'review'];

export function stepIndex(step: OnboardingStepId): number {
  return WIZARD_STEP_ORDER.indexOf(step);
}

export function stepPath(step: OnboardingStepId): string {
  return `/onboarding/${step}`;
}

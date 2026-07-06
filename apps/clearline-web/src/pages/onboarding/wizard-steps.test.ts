import { describe, expect, it } from 'vitest';
import { stepIndex, stepPath } from './wizard-steps';

describe('stepIndex', () => {
  it('maps each step to its wizard-order position', () => {
    expect(stepIndex('business')).toBe(0);
    expect(stepIndex('owners')).toBe(1);
    expect(stepIndex('documents')).toBe(2);
    expect(stepIndex('review')).toBe(3);
  });
});

describe('stepPath', () => {
  it('maps each step to its onboarding URL', () => {
    expect(stepPath('business')).toBe('/onboarding/business');
    expect(stepPath('owners')).toBe('/onboarding/owners');
    expect(stepPath('documents')).toBe('/onboarding/documents');
    expect(stepPath('review')).toBe('/onboarding/review');
  });
});

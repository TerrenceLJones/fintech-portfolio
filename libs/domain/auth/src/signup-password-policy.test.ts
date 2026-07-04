import { describe, expect, it } from 'vitest';
import { evaluateSignUpPassword, isValidSignUpPassword } from './signup-password-policy';

describe('signup password policy', () => {
  it('reports every requirement unmet for an empty password', () => {
    expect(evaluateSignUpPassword('')).toEqual({
      minLength: false,
      hasUpperAndLower: false,
      hasNumber: false,
      hasSymbol: false,
    });
  });

  it('reports every requirement met for a password satisfying all four', () => {
    expect(evaluateSignUpPassword('Correct-Horse-1')).toEqual({
      minLength: true,
      hasUpperAndLower: true,
      hasNumber: true,
      hasSymbol: true,
    });
  });

  it('requires at least 12 characters', () => {
    expect(evaluateSignUpPassword('Short-1a').minLength).toBe(false);
    expect(evaluateSignUpPassword('LongEnough-1a').minLength).toBe(true);
  });

  it('requires both an uppercase and a lowercase letter', () => {
    expect(evaluateSignUpPassword('alllowercase-1!').hasUpperAndLower).toBe(false);
    expect(evaluateSignUpPassword('ALLUPPERCASE-1!').hasUpperAndLower).toBe(false);
    expect(evaluateSignUpPassword('MixedCase-1!ab').hasUpperAndLower).toBe(true);
  });

  it('requires a digit', () => {
    expect(evaluateSignUpPassword('NoDigitsHere!ab').hasNumber).toBe(false);
    expect(evaluateSignUpPassword('HasADigit1!ab').hasNumber).toBe(true);
  });

  it('requires a symbol', () => {
    expect(evaluateSignUpPassword('NoSymbolHere1ab').hasSymbol).toBe(false);
    expect(evaluateSignUpPassword('HasASymbol1!ab').hasSymbol).toBe(true);
  });

  it('isValidSignUpPassword is true only when every requirement is met', () => {
    expect(isValidSignUpPassword('weak')).toBe(false);
    expect(isValidSignUpPassword('NoSymbolHere1ab')).toBe(false);
    expect(isValidSignUpPassword('Correct-Horse-1')).toBe(true);
  });
});

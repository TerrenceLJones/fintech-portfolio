const MIN_LENGTH = 12;

export interface SignUpPasswordRequirements {
  minLength: boolean;
  hasUpperAndLower: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

/**
 * Sign-up's password bar is stricter than login/reset's `isValidPassword` (12+ chars and a
 * symbol, vs. 10+ with no symbol) — kept as its own policy rather than parameterizing the
 * existing one, since AC-04 needs each requirement's pass/fail exposed individually for the
 * sign-up page's live checklist, not just a single valid/invalid boolean.
 */
export function evaluateSignUpPassword(password: string): SignUpPasswordRequirements {
  return {
    minLength: password.length >= MIN_LENGTH,
    hasUpperAndLower: /[A-Z]/.test(password) && /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
  };
}

export function isValidSignUpPassword(password: string): boolean {
  const requirements = evaluateSignUpPassword(password);
  return Object.values(requirements).every(Boolean);
}

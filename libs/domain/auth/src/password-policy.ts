const MIN_LENGTH = 10;

/** Minimum bar for a new password: 10+ chars with at least one upper, lower, and digit. */
export function isValidPassword(password: string): boolean {
  return (
    password.length >= MIN_LENGTH &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

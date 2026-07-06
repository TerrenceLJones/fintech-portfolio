const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** True once a refresh token's family is 30 days or more past the login that created it — rotation doesn't reset this, see classifyRefreshTokenPresentation. */
export function isRefreshTokenExpired(issuedAt: number, now: number): boolean {
  return now - issuedAt >= REFRESH_TOKEN_TTL_MS;
}

export interface RefreshTokenPresentation {
  /** True if this exact token hash was already consumed by an earlier rotation. */
  isUsed: boolean;
  /** True if the token's family has been revoked (reuse detected, or invalidated elsewhere e.g. a password change). */
  isRevoked: boolean;
  /** The family's original login time — the anchor for expiry, not the most recent rotation. */
  issuedAt: number;
}

export type RefreshTokenClassification = 'valid' | 'reused' | 'revoked' | 'expired';

/**
 * Classifies a presented refresh token against its family's current state. Revocation is checked
 * first: a family that's already dead (from a prior reuse-detection or a password change) reports
 * 'revoked' even if the presented token also happens to be a used or expired one — there's no
 * additional signal a second-order check would add once the family is already gone. Reuse is
 * checked before expiry for the same reason a stale token might resurface long after its family's
 * TTL — the reuse itself is the more actionable finding.
 */
export function classifyRefreshTokenPresentation(
  presentation: RefreshTokenPresentation,
  now: number,
): RefreshTokenClassification {
  if (presentation.isRevoked) return 'revoked';
  if (presentation.isUsed) return 'reused';
  if (isRefreshTokenExpired(presentation.issuedAt, now)) return 'expired';
  return 'valid';
}

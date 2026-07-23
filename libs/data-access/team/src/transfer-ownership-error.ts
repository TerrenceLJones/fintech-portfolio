/**
 * Thrown when POST /api/team/owner-transfer fails with a specific, named reason (US-CW-043 AC-07) so
 * the UI can surface exactly why a transfer was rejected rather than a generic error. `code` mirrors
 * the server's TeamErrorResponse `error`:
 *  - `not_owner` — the caller is not/no longer the Owner (a concurrent transfer already ran, AC-02/07)
 *  - `reauth_failed` — the password or TOTP step-up did not verify (AC-04)
 *  - `member_not_found` — the selected new Owner is no longer a member (AC-07)
 *  - `invalid_transfer_target` — the selected target was the acting Owner themselves (AC-01)
 */
export type TransferOwnershipErrorCode =
  'not_owner' | 'reauth_failed' | 'member_not_found' | 'invalid_transfer_target';

export class TransferOwnershipError extends Error {
  readonly code: TransferOwnershipErrorCode;

  constructor(code: TransferOwnershipErrorCode) {
    super(`owner_transfer_${code}`);
    this.name = 'TransferOwnershipError';
    this.code = code;
  }
}

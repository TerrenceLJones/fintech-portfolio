/**
 * Connected bank accounts managed in Settings → Connected Accounts (US-CW-038). An org funds ACH
 * transfers from accounts connected either through Plaid (mocked — there is no real Plaid in the
 * demo) or by manual routing/account entry verified with two micro-deposits. Gated by
 * `bank-accounts:manage` (Controller/Admin/Owner). Removal never disturbs an in-flight payment; only
 * future transfers are blocked (AC-07).
 */

/** How an account was linked. Plaid accounts land verified; manual accounts require micro-deposits. */
export type ConnectionMethod = 'plaid' | 'manual';

/**
 * An account's connection state — always carried as text so the UI can pair it with a glyph and never
 * signal status by colour alone (design §19 intro). `pending_verification` is a manual account awaiting
 * its two micro-deposit amounts; `reconnect_required` is a Plaid account that hit ITEM_LOGIN_REQUIRED
 * (AC-08); `verification_locked` is a manual account that failed verification three times (AC-06).
 */
export type ConnectionStatus =
  'connected' | 'pending_verification' | 'reconnect_required' | 'verification_locked';

/** A connected (or connecting) bank account. The full account number never crosses the wire — only last4. */
export interface ConnectedAccount {
  id: string;
  institutionName: string;
  /** Last four of the account number, shown masked as ••••1234 (AC-04/07). */
  last4: string;
  method: ConnectionMethod;
  status: ConnectionStatus;
  /** Remaining micro-deposit verification attempts for a manual account; absent for Plaid accounts (AC-06). */
  verificationAttemptsRemaining?: number;
}

export interface ConnectedAccountsResponse {
  accounts: ConnectedAccount[];
}

export interface ConnectedAccountResponse {
  account: ConnectedAccount;
}

/**
 * A manual account connection (AC-05). Routing must be 9 digits (design §17.2 shows the 9-digit rule);
 * the account number is stored only as last4. A duplicate of an already-connected account is rejected
 * rather than silently duplicated (edge case).
 */
export interface ConnectManuallyRequest {
  routingNumber: string;
  accountNumber: string;
}

/** Submit the two micro-deposit amounts (minor units) to verify a pending manual account (AC-05/06). */
export interface VerifyMicroDepositsRequest {
  amountsMinorUnits: [number, number];
}

/** The result of a verification attempt — the client renders the updated account and, on a miss, the retry copy. */
export type VerifyOutcome = 'verified' | 'mismatch' | 'locked';

export interface VerifyMicroDepositsResponse {
  account: ConnectedAccount;
  outcome: VerifyOutcome;
  /** Attempts left after this one; 0 once verified or locked (AC-06). */
  attemptsRemaining: number;
}

export type ConnectedAccountErrorCode =
  | 'forbidden_role'
  | 'unauthenticated'
  | 'invalid_routing'
  | 'invalid_account'
  | 'already_connected'
  | 'account_not_found'
  | 'not_pending';

/** Body of a 4xx from a connected-accounts endpoint — the client maps `error` to inline copy. */
export interface ConnectedAccountErrorResponse {
  error: ConnectedAccountErrorCode;
}

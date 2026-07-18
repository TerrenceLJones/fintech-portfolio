import type { AuditActor, Money } from '@clearline/contracts';
import type { AuthService } from '../services/auth.service';
import { bearerToken } from './session-auth';

/**
 * Resolve the acting user's audit identity from their OWN session access token — never client-supplied
 * claims. Shared by every feature handler that emits an audit event (payments, approvals, card
 * controls, and the audit-log read itself) so "who did this" is always server-derived and consistent.
 * Returns null when there's no active session, in which case the caller has already been 401'd and
 * nothing is recorded.
 */
export function resolveAuditActor(request: Request, authService: AuthService): AuditActor | null {
  const accessToken = bearerToken(request);
  if (!accessToken) return null;
  const session = authService.checkSession(accessToken);
  if (session.outcome !== 'active') return null;
  return {
    id: session.userId!,
    name: session.displayName ?? session.userId!,
    role: session.role!,
  };
}

/**
 * Format a Money value for an audit event's human-readable detail line (e.g. "$2,000.00"). Two-decimal
 * currencies only, which is every currency in this demo — the audit log is a display artifact, so a
 * simple Intl format is enough; monetary invariants live in the domain layer, not here.
 */
export function formatAuditMoney(money: Money): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currency,
  }).format(money.amountMinorUnits / 100);
}

import { authenticatedFetch } from '@clearline/data-access-auth';
import type { AuditLogResponse } from '@clearline/contracts';
import { AuditForbiddenError } from './audit-forbidden-error';

/**
 * Fetch the append-only audit log. A 403 becomes AuditForbiddenError (the page renders access-denied);
 * any other non-2xx throws so React Query surfaces its error state. Reading the log is itself an
 * audited action server-side (US-CW-021 AC-06) — so every call this makes appends an access event that
 * the returned list already reflects.
 */
export async function fetchAuditLog(): Promise<AuditLogResponse> {
  const response = await authenticatedFetch('/api/audit-log');
  if (response.status === 403) {
    throw new AuditForbiddenError();
  }
  if (!response.ok) {
    throw new Error('audit_log_failed');
  }
  return response.json() as Promise<AuditLogResponse>;
}

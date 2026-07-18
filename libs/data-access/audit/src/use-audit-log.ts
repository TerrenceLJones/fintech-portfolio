import { useQuery } from '@tanstack/react-query';
import { auditKeys } from './audit-query-keys';
import { fetchAuditLog } from './fetch-audit-log';

/**
 * The append-only audit log, newest-first (US-CW-021). Controller/Admin only — a 403 surfaces as the
 * typed AuditForbiddenError the page turns into access-denied. `retry: false` so a forbidden read
 * doesn't hammer the endpoint (each attempt would append another access event server-side), and
 * `staleTime: 0` so re-opening the view always refetches — and thus re-audits the access (AC-06).
 */
export function useAuditLog() {
  return useQuery({
    queryKey: auditKeys.log(),
    queryFn: fetchAuditLog,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
}

import { AuditService } from './audit.service';

/**
 * The one AuditService the running app binds to, so an action taken in one feature (a payment,
 * approval, or card freeze) and a subsequent read of the audit log act on the same in-memory,
 * append-only store (US-CW-021). This is the shared/central emission mechanism the story calls for —
 * payments, approvals, and cards handlers all record into this instance rather than duplicating a log
 * per feature. Not persisted across a full page reload — it resets to the seed, which is fine for a
 * demo; tests inject their own isolated, fixed-clock instance.
 */
export const sharedAuditService = new AuditService();

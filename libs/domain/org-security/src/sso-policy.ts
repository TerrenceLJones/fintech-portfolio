import type { SsoTestResult, TestSsoRequest } from '@clearline/contracts';

/**
 * The mocked SAML connection-test evaluation (US-CW-040 AC-01). There is no real SAML broker in the
 * demo — this is a deterministic surrogate that rewards a well-formed config and returns a specific,
 * fixable reason otherwise, so the guardrail ("Enable stays unavailable until a test passes") is
 * exercised end-to-end. A well-formed config is an https metadata URL, a non-empty entity ID, and a
 * PEM-looking certificate.
 */
export function evaluateSsoTest(req: TestSsoRequest): {
  result: SsoTestResult;
  reason: string | null;
} {
  if (!req.metadataUrl.startsWith('https://')) {
    return { result: 'failed', reason: 'Metadata URL unreachable' };
  }
  if (!req.certificate.includes('BEGIN CERTIFICATE')) {
    return { result: 'failed', reason: 'Certificate validation failed' };
  }
  if (req.entityId.trim() === '') {
    return { result: 'failed', reason: 'Entity ID is required' };
  }
  return { result: 'passed', reason: null };
}

/** Whether every required SSO field is present — the client's pre-submit gate on the Test button. */
export function validateSsoConfig(req: {
  metadataUrl: string;
  entityId: string;
  certificate: string;
}): { ok: boolean } {
  const ok =
    req.metadataUrl.trim() !== '' && req.entityId.trim() !== '' && req.certificate.trim() !== '';
  return { ok };
}

/** Whether SSO may be enabled: only once the most recent connection test passed (AC-01/02). */
export function canEnableSso(sso: {
  lastTest: { result: SsoTestResult; reason?: string | null } | null;
}): boolean {
  return sso.lastTest?.result === 'passed';
}

/**
 * A short, non-secret digest of an uploaded IdP certificate (AC-10) — an FNV-1a hash rendered as 8 hex
 * chars. This is all that is ever persisted or displayed for the cert; the certificate itself is used
 * only to evaluate the handshake and then discarded. Not a cryptographic fingerprint — a demo surrogate
 * so the admin can confirm which cert is on file without the material leaving the request.
 */
export function certificateFingerprint(certificate: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < certificate.length; i++) {
    hash ^= certificate.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

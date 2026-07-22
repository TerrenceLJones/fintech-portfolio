/**
 * Seed data for Organization Security & Compliance (US-CW-040). There is no real client-IP, SAML broker,
 * or SCIM directory in the demo — these constants stand in so the page's guardrails (self-lockout, the
 * SSO connection-test gate) can be exercised deterministically.
 */

/**
 * The acting admin's mocked "current IP" for the IP-allowlist guardrails (AC-06/07). Matches the address
 * named in the story's self-lockout copy so the demo reads exactly as specified. Deliberately outside any
 * default allowlist so adding an unrelated range trips the self-lockout guard, and inside 203.0.113.0/24
 * so adding that range clears it.
 */
export const DEMO_CURRENT_IP = '203.0.113.42';

/** A ready-to-use SSO config the Beacon guide points at, chosen so the mocked connection test passes. */
export const DEMO_SSO_METADATA_URL = 'https://idp.example.com/app/saml/metadata';
export const DEMO_SSO_ENTITY_ID = 'urn:clearline:demo';
export const DEMO_SSO_CERTIFICATE =
  '-----BEGIN CERTIFICATE-----\nMIIDdemoClearlineSsoCertificateFixture0123456789==\n-----END CERTIFICATE-----';

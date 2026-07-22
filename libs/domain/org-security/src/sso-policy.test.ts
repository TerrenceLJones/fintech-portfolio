import { describe, expect, it } from 'vitest';
import {
  canEnableSso,
  certificateFingerprint,
  evaluateSsoTest,
  validateSsoConfig,
} from './sso-policy';

const VALID_CERT = '-----BEGIN CERTIFICATE-----\nMIIFakeCertData==\n-----END CERTIFICATE-----';
const VALID = {
  metadataUrl: 'https://idp.example.com/metadata',
  entityId: 'urn:acme',
  certificate: VALID_CERT,
};

describe('evaluateSsoTest', () => {
  it('passes for a well-formed config', () => {
    expect(evaluateSsoTest(VALID)).toEqual({ result: 'passed', reason: null });
  });

  it('fails with a specific reason when the metadata URL is unreachable (not https)', () => {
    expect(evaluateSsoTest({ ...VALID, metadataUrl: 'http://idp.example.com/metadata' })).toEqual({
      result: 'failed',
      reason: 'Metadata URL unreachable',
    });
  });

  it('fails with a specific reason when the certificate is invalid', () => {
    expect(evaluateSsoTest({ ...VALID, certificate: 'garbage' })).toEqual({
      result: 'failed',
      reason: 'Certificate validation failed',
    });
  });

  it('fails when the entity ID is missing', () => {
    expect(evaluateSsoTest({ ...VALID, entityId: '  ' })).toEqual({
      result: 'failed',
      reason: 'Entity ID is required',
    });
  });
});

describe('validateSsoConfig', () => {
  it('is ok when all fields are present', () => {
    expect(validateSsoConfig(VALID).ok).toBe(true);
  });

  it('is not ok when a field is blank', () => {
    expect(validateSsoConfig({ ...VALID, metadataUrl: '' }).ok).toBe(false);
  });
});

describe('canEnableSso', () => {
  it('is false until a test has passed', () => {
    expect(canEnableSso({ lastTest: null })).toBe(false);
    expect(canEnableSso({ lastTest: { result: 'failed', reason: 'x' } })).toBe(false);
  });

  it('is true once the last test passed', () => {
    expect(canEnableSso({ lastTest: { result: 'passed', reason: null } })).toBe(true);
  });
});

describe('certificateFingerprint', () => {
  it('is deterministic and does not echo the certificate', () => {
    const fp = certificateFingerprint(VALID_CERT);
    expect(fp).toMatch(/^[0-9a-f]{8}$/);
    expect(fp).toBe(certificateFingerprint(VALID_CERT));
    expect(VALID_CERT.includes(fp)).toBe(false);
  });

  it('differs for different certificates', () => {
    expect(certificateFingerprint('cert-a')).not.toBe(certificateFingerprint('cert-b'));
  });
});

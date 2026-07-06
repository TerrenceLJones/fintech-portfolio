import { describe, expect, it } from 'vitest';
import {
  isDocumentVerificationBlocked,
  MAX_DOCUMENT_VERIFICATION_ATTEMPTS,
} from './document-retry-policy';

describe('isDocumentVerificationBlocked', () => {
  it('is not blocked with 0 prior attempts', () => {
    expect(isDocumentVerificationBlocked(0)).toBe(false);
  });

  it('is not blocked with 2 prior attempts', () => {
    expect(isDocumentVerificationBlocked(2)).toBe(false);
  });

  it('is blocked once 3 attempts have failed', () => {
    expect(isDocumentVerificationBlocked(3)).toBe(true);
  });

  it('remains blocked beyond 3 attempts', () => {
    expect(isDocumentVerificationBlocked(4)).toBe(true);
  });

  it('exposes the cap as a constant', () => {
    expect(MAX_DOCUMENT_VERIFICATION_ATTEMPTS).toBe(3);
  });
});

import { describe, expect, it } from 'vitest';
import { API_KEY_MASK_PREFIX, API_KEY_SCOPES, hasScope, maskApiKey } from './api-key-policy';

describe('maskApiKey', () => {
  it('shows the sk_live_ prefix, 14 bullets, and the last four real characters (AC-01)', () => {
    expect(maskApiKey('sk_live_9f2c7b4e1a3d6cab3f')).toBe(
      `${API_KEY_MASK_PREFIX}••••••••••••••ab3f`,
    );
  });

  it('masks regardless of the plaintext length, always ending in the true last four', () => {
    expect(maskApiKey('sk_live_short7d21')).toBe(`${API_KEY_MASK_PREFIX}••••••••••••••7d21`);
  });

  it('never leaks any character other than the trailing four (AC-02)', () => {
    const masked = maskApiKey('sk_live_SECRETSECRETSECRETwxyz');
    expect(masked).not.toContain('SECRET');
    expect(masked.endsWith('wxyz')).toBe(true);
  });
});

describe('hasScope', () => {
  it('is true when the granted scopes include the required one', () => {
    expect(hasScope(['read:transactions', 'read:cards'], 'read:cards')).toBe(true);
  });

  it('is false when the required scope is absent — a read-only key cannot write (AC-03)', () => {
    expect(hasScope(['read:transactions'], 'write:transfers')).toBe(false);
  });
});

describe('API_KEY_SCOPES', () => {
  it('offers the scopes named in the story with human labels', () => {
    const scopes = API_KEY_SCOPES.map((s) => s.scope);
    expect(scopes).toContain('read:transactions');
    expect(scopes).toContain('read:cards');
    expect(scopes).toContain('write:transfers');
    for (const option of API_KEY_SCOPES) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.description.length).toBeGreaterThan(0);
    }
  });
});

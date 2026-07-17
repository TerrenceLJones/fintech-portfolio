import { describe, expect, it } from 'vitest';
import { RECONCILIATION_QUERY_KEY, reconciliationKeys } from './reconciliation-query-keys';

describe('reconciliationKeys', () => {
  it('nests every panel under the root key so one invalidation refetches them all', () => {
    for (const key of [
      reconciliationKeys.summary(),
      reconciliationKeys.exceptions(),
      reconciliationKeys.matched(),
      reconciliationKeys.balance(),
    ]) {
      expect(key[0]).toBe(RECONCILIATION_QUERY_KEY[0]);
    }
  });

  it('gives each panel a distinct key', () => {
    const keys = [
      reconciliationKeys.summary(),
      reconciliationKeys.exceptions(),
      reconciliationKeys.matched(),
      reconciliationKeys.balance(),
    ].map((k) => k.join('/'));
    expect(new Set(keys).size).toBe(4);
  });
});

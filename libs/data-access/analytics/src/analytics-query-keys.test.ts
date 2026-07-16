import { describe, expect, it } from 'vitest';
import { ANALYTICS_QUERY_KEY, analyticsKeys, rangeQuery } from './analytics-query-keys';

const JUNE = { from: '2026-06-01', to: '2026-06-30' };
const JULY = { from: '2026-07-01', to: '2026-07-31' };

describe('analyticsKeys', () => {
  it('scopes every section key under the analytics root', () => {
    for (const key of Object.values(analyticsKeys)) {
      expect(key(JUNE).slice(0, ANALYTICS_QUERY_KEY.length)).toEqual([...ANALYTICS_QUERY_KEY]);
    }
  });

  it('keys different ranges separately so one range never shows under another', () => {
    expect(analyticsKeys.summary(JUNE)).not.toEqual(analyticsKeys.summary(JULY));
  });

  it('keys different sections separately for the same range', () => {
    expect(analyticsKeys.summary(JUNE)).not.toEqual(analyticsKeys.topVendors(JUNE));
  });
});

describe('rangeQuery', () => {
  it('builds the from/to query string', () => {
    expect(rangeQuery(JUNE)).toBe('?from=2026-06-01&to=2026-06-30');
  });
});

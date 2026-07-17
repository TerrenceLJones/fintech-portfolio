import { describe, expect, it } from 'vitest';
import { isExactNameMatch, nameSimilarity, normalizeName } from './name-similarity';

describe('normalizeName', () => {
  it('lower-cases, strips punctuation and collapses whitespace', () => {
    expect(normalizeName('  ABC   Corp., Inc. ')).toBe('abc corp inc');
  });
});

describe('isExactNameMatch', () => {
  it('matches names that differ only by case and punctuation', () => {
    expect(isExactNameMatch('Northwind Traders', 'northwind traders')).toBe(true);
    expect(isExactNameMatch('ACME, LLC', 'ACME LLC')).toBe(true);
  });

  it('does NOT treat a suffix variant as an exact match — it must stay a fuzzy suggestion (AC-03)', () => {
    expect(isExactNameMatch('ABC Corp', 'ABC Corporation')).toBe(false);
  });
});

describe('nameSimilarity', () => {
  it('is 1 for identical (normalised) names and 0 for nothing in common', () => {
    expect(nameSimilarity('Figma', 'figma')).toBe(1);
    expect(nameSimilarity('ABC', 'XYZ')).toBe(0);
  });

  it('scores a suffix variant high but below exact so it surfaces as a suggestion (AC-03)', () => {
    const score = nameSimilarity('ABC Corp', 'ABC Corporation');
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThan(1);
  });

  it('is symmetric', () => {
    expect(nameSimilarity('ABC Corp', 'ABC Corporation')).toBeCloseTo(
      nameSimilarity('ABC Corporation', 'ABC Corp'),
    );
  });
});

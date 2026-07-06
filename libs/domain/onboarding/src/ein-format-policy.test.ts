import { describe, expect, it } from 'vitest';
import { isValidEinFormat } from './ein-format-policy';

describe('isValidEinFormat', () => {
  it('accepts a well-formed EIN (XX-XXXXXXX)', () => {
    expect(isValidEinFormat('12-3456789')).toBe(true);
  });

  it('rejects an EIN missing the hyphen', () => {
    expect(isValidEinFormat('123456789')).toBe(false);
  });

  it('rejects an EIN with too few digits', () => {
    expect(isValidEinFormat('12-345678')).toBe(false);
  });

  it('rejects an EIN with too many digits', () => {
    expect(isValidEinFormat('12-34567890')).toBe(false);
  });

  it('rejects an EIN with non-digit characters', () => {
    expect(isValidEinFormat('AB-3456789')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidEinFormat('')).toBe(false);
  });
});

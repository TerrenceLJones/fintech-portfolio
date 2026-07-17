import { describe, expect, it } from 'vitest';
import { identityDetail, initialsFromName, roleLabel } from './identity';

describe('roleLabel', () => {
  it('maps each role to its human-readable label', () => {
    expect(roleLabel('employee')).toBe('Employee');
    expect(roleLabel('finance_manager')).toBe('Finance Manager');
    expect(roleLabel('controller')).toBe('Controller');
  });
});

describe('initialsFromName', () => {
  it('takes the first letter of the first two words, uppercased', () => {
    expect(initialsFromName('Priya Nair')).toBe('PN');
    expect(initialsFromName('Marcus Okafor')).toBe('MO');
  });

  it('uses only the first two words of a longer name', () => {
    expect(initialsFromName('Ana Maria Reyes')).toBe('AM');
  });

  it('handles a single-word name', () => {
    expect(initialsFromName('Cher')).toBe('C');
  });

  it('collapses extra whitespace and returns empty for a blank name', () => {
    expect(initialsFromName('  Priya   Nair ')).toBe('PN');
    expect(initialsFromName('')).toBe('');
    expect(initialsFromName('   ')).toBe('');
  });
});

describe('identityDetail', () => {
  it('shows a compact approval limit for a Finance Manager in the given currency', () => {
    expect(identityDetail('finance_manager', 1_000_000, false, 'USD')).toBe('$10k limit');
  });

  it('keeps a non-round limit accurate rather than rounding to a misleading whole unit', () => {
    // $2,500 must read "$2.5k", not "$3k"; $10,500 must read "$10.5k", not "$11k".
    expect(identityDetail('finance_manager', 250_000, false, 'USD')).toBe('$2.5k limit');
    expect(identityDetail('finance_manager', 1_050_000, false, 'USD')).toBe('$10.5k limit');
  });

  it('formats the limit in whatever organization currency it is given (not assumed USD)', () => {
    // EUR: 2-decimal minor units, so 1_000_000 -> €10,000 -> "€10k".
    expect(identityDetail('finance_manager', 1_000_000, false, 'EUR')).toBe('€10k limit');
    // JPY: 0-decimal minor units, so 1_000_000 -> ¥1,000,000 -> "¥1m".
    expect(identityDetail('finance_manager', 1_000_000, false, 'JPY')).toBe('¥1m limit');
  });

  it('shows Unlimited for a Controller without needing a currency', () => {
    expect(identityDetail('controller', null, false, undefined)).toBe('Unlimited');
  });

  it('shows no approval detail for an Employee', () => {
    expect(identityDetail('employee', null, false, 'USD')).toBeNull();
  });

  it('returns null for a Finance Manager whose limit has not loaded yet', () => {
    expect(identityDetail('finance_manager', null, false, 'USD')).toBeNull();
  });

  it('withholds the numeric limit until the organization currency is available', () => {
    expect(identityDetail('finance_manager', 1_000_000, false, undefined)).toBeNull();
  });

  it('appends an Admin indicator where applicable', () => {
    expect(identityDetail('employee', null, true, 'USD')).toBe('Admin');
    expect(identityDetail('finance_manager', 1_000_000, true, 'USD')).toBe('$10k limit · Admin');
    expect(identityDetail('controller', null, true, undefined)).toBe('Unlimited · Admin');
  });
});

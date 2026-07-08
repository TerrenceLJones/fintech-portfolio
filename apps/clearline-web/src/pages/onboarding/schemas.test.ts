import { describe, expect, it } from 'vitest';
import { businessInfoSchema, ownerSchema } from './schemas';

const validBusiness = {
  legalName: 'Northwind Labs, Inc.',
  ein: '12-3456789',
  structure: 'C-Corporation',
  addressLine1: '220 Mission St',
  city: 'San Francisco',
  state: 'CA',
  postalCode: '94105',
};

describe('businessInfoSchema', () => {
  it('accepts a fully valid business', () => {
    expect(businessInfoSchema.safeParse(validBusiness).success).toBe(true);
  });

  it('rejects a malformed EIN', () => {
    const result = businessInfoSchema.safeParse({ ...validBusiness, ein: '123456789' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing legal name', () => {
    const result = businessInfoSchema.safeParse({ ...validBusiness, legalName: '' });
    expect(result.success).toBe(false);
  });
});

describe('ownerSchema', () => {
  it('accepts a low-ownership owner without DOB or SSN/ITIN', () => {
    const result = ownerSchema.safeParse({
      firstName: 'Marcus',
      lastName: 'Okafor',
      ownershipPercent: 10,
    });
    expect(result.success).toBe(true);
  });

  it('requires a first and last name', () => {
    expect(
      ownerSchema.safeParse({ firstName: '', lastName: 'Okafor', ownershipPercent: 10 }).success,
    ).toBe(false);
    expect(
      ownerSchema.safeParse({ firstName: 'Marcus', lastName: '', ownershipPercent: 10 }).success,
    ).toBe(false);
  });

  it('requires a date of birth once ownership reaches the 25% KYC threshold', () => {
    const result = ownerSchema.safeParse({
      firstName: 'Dara',
      lastName: 'Reyes',
      ownershipPercent: 60,
      ssnItin: '123-45-4417',
    });
    expect(result.success).toBe(false);
  });

  it('requires an SSN/ITIN once ownership reaches the 25% KYC threshold', () => {
    const result = ownerSchema.safeParse({
      firstName: 'Dara',
      lastName: 'Reyes',
      ownershipPercent: 60,
      dateOfBirth: '1986-04-12',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a KYC-required owner once DOB and SSN/ITIN are both present', () => {
    const result = ownerSchema.safeParse({
      firstName: 'Dara',
      lastName: 'Reyes',
      ownershipPercent: 60,
      dateOfBirth: '1986-04-12',
      ssnItin: '123-45-4417',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an ownership percent above 100', () => {
    const result = ownerSchema.safeParse({
      firstName: 'Dara',
      lastName: 'Reyes',
      ownershipPercent: 150,
    });
    expect(result.success).toBe(false);
  });
});

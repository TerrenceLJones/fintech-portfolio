import { describe, expect, it } from 'vitest';
import { isValidCidr, ipInCidr, isIpAllowed, wouldLockOut } from './cidr';

describe('isValidCidr', () => {
  it('accepts well-formed IPv4 CIDR ranges', () => {
    expect(isValidCidr('203.0.113.0/24')).toBe(true);
    expect(isValidCidr('10.0.0.0/8')).toBe(true);
    expect(isValidCidr('192.168.1.1/32')).toBe(true);
    expect(isValidCidr('0.0.0.0/0')).toBe(true);
  });

  it('rejects malformed ranges', () => {
    expect(isValidCidr('203.0.113.0')).toBe(false); // no prefix
    expect(isValidCidr('203.0.113.0/33')).toBe(false); // prefix > 32
    expect(isValidCidr('256.0.113.0/24')).toBe(false); // octet > 255
    expect(isValidCidr('203.0.113/24')).toBe(false); // too few octets
    expect(isValidCidr('not-an-ip/24')).toBe(false);
    expect(isValidCidr('203.0.113.0/-1')).toBe(false);
    expect(isValidCidr(' 203.0.113.0/24 ')).toBe(false); // no surrounding whitespace
  });
});

describe('ipInCidr', () => {
  it('matches an IP inside the range', () => {
    expect(ipInCidr('203.0.113.42', '203.0.113.0/24')).toBe(true);
    expect(ipInCidr('203.0.113.42', '203.0.113.42/32')).toBe(true);
    expect(ipInCidr('10.4.5.6', '10.0.0.0/8')).toBe(true);
  });

  it('rejects an IP outside the range', () => {
    expect(ipInCidr('203.0.114.42', '203.0.113.0/24')).toBe(false);
    expect(ipInCidr('203.0.113.43', '203.0.113.42/32')).toBe(false);
    expect(ipInCidr('11.0.0.1', '10.0.0.0/8')).toBe(false);
  });

  it('a /0 range matches every IP', () => {
    expect(ipInCidr('8.8.8.8', '0.0.0.0/0')).toBe(true);
  });
});

describe('isIpAllowed', () => {
  it('an empty allowlist allows every IP (all IPs allowed)', () => {
    expect(isIpAllowed('203.0.113.42', [])).toBe(true);
  });

  it('allows an IP that falls within any listed range', () => {
    expect(isIpAllowed('203.0.113.42', ['198.51.100.0/24', '203.0.113.0/24'])).toBe(true);
  });

  it('denies an IP outside every listed range', () => {
    expect(isIpAllowed('203.0.113.42', ['198.51.100.0/24'])).toBe(false);
  });
});

describe('wouldLockOut', () => {
  it('is false when the resulting allowlist is empty', () => {
    expect(wouldLockOut('203.0.113.42', [])).toBe(false);
  });

  it('is false when the current IP is covered', () => {
    expect(wouldLockOut('203.0.113.42', ['203.0.113.0/24'])).toBe(false);
  });

  it('is true when a non-empty allowlist excludes the current IP', () => {
    expect(wouldLockOut('203.0.113.42', ['198.51.100.0/24'])).toBe(true);
  });
});

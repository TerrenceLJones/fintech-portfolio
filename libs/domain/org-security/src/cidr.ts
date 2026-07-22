/**
 * IPv4 CIDR helpers backing the IP allowlist (US-CW-040 AC-06/07/08). Pure arithmetic — no network — so
 * the same rules drive the mock backend's server-side guard and any client pre-flight. IPv4 only, which
 * is all the demo models; an IPv6 allowlist is out of scope.
 */

const OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const CIDR_RE = new RegExp(`^${OCTET}\\.${OCTET}\\.${OCTET}\\.${OCTET}/(3[0-2]|[12]?\\d)$`);

/** Whether `value` is a syntactically valid IPv4 CIDR range (e.g. "203.0.113.0/24"), no surrounding whitespace. */
export function isValidCidr(value: string): boolean {
  return CIDR_RE.test(value);
}

/** Parse a dotted-quad IPv4 address to an unsigned 32-bit integer, or null if malformed. */
function ipToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value << 8) | octet;
  }
  return value >>> 0;
}

/** Whether `ip` falls within the CIDR `range`. False if either is malformed. */
export function ipInCidr(ip: string, range: string): boolean {
  if (!isValidCidr(range)) return false;
  const [network = '', prefixStr = '0'] = range.split('/');
  const ipInt = ipToInt(ip);
  const networkInt = ipToInt(network);
  if (ipInt === null || networkInt === null) return false;
  const prefix = Number(prefixStr);
  // A /0 mask is 0 across all 32 bits; the shift below is only defined for 1–32, so special-case it.
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (networkInt & mask);
}

/**
 * Whether `ip` is permitted by `ranges`. An EMPTY allowlist permits every IP — clearing the last range
 * re-opens access from all IPs (AC-08). Otherwise the IP must fall within at least one listed range.
 */
export function isIpAllowed(ip: string, ranges: readonly string[]): boolean {
  if (ranges.length === 0) return true;
  return ranges.some((range) => ipInCidr(ip, range));
}

/**
 * Whether saving `ranges` would lock `ip` out — the self-lockout guard (AC-07). A non-empty allowlist
 * that excludes the acting admin's current IP is a lockout; an empty allowlist never is.
 */
export function wouldLockOut(ip: string, ranges: readonly string[]): boolean {
  return ranges.length > 0 && !isIpAllowed(ip, ranges);
}

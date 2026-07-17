/** Parse an ISO-8601 calendar date (YYYY-MM-DD) to a UTC-midnight timestamp, or null if malformed. */
function parseIsoDate(iso: string): number | null {
  const timestamp = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whole calendar days between two ISO dates, always non-negative. Returns Infinity when either date is
 * malformed, so a bad value can never masquerade as a same-day match.
 */
export function daysBetween(aIso: string, bIso: string): number {
  const a = parseIsoDate(aIso);
  const b = parseIsoDate(bIso);
  if (a === null || b === null) return Infinity;
  return Math.round(Math.abs(a - b) / MS_PER_DAY);
}

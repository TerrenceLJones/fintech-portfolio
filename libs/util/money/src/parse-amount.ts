import { currencySymbol } from './currency-symbol';
import { toMinorUnits } from './to-minor-units';

/** Escapes a string for literal use inside a `RegExp` (the symbol may be `$`, which is special). */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parses a user-typed amount into the given currency's minor units, tolerating the currency's own
 * symbol (USD `$`, EUR `€`, or a raw code like `BHD`), thousands separators and surrounding
 * whitespace — so a pasted, formatted amount still parses for any currency, not just dollars.
 * Returns null for anything that isn't a positive number, so a caller can keep submit blocked
 * without a network call. Conversion is currency-aware via {@link toMinorUnits} (JPY has 0
 * minor-unit decimals, BHD 3), never a hardcoded ×100; `currency` defaults to USD.
 *
 * Amounts are interpreted in en-US number format (`,` groups, `.` is the decimal point). More
 * precise input than a currency permits is rounded to its minor unit (e.g. `100.5` JPY → 101).
 */
export function parseAmountToMinorUnits(input: string, currency: string = 'USD'): number | null {
  // Strip the currency's own symbol, thousands separators and whitespace before validating.
  const symbol = escapeRegExp(currencySymbol(currency));
  const cleaned = input.replace(new RegExp(`${symbol}|[,\\s]`, 'g'), '');
  // Reject empty input or anything that isn't plain digits with an optional single decimal point.
  if (cleaned === '' || !/^\d*\.?\d*$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  // Guard against NaN and non-positive amounts (e.g. a bare "." or "0").
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return toMinorUnits(amount, currency);
}

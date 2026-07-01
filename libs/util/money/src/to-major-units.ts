import type { Money } from '@fintech-portfolio/contracts';

function minorUnitExponent(currency: string): number {
  return (
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

/**
 * Converts an integer minor-units amount to a major-unit float (e.g. cents -> dollars),
 * using each currency's own minor-unit exponent rather than assuming 2 decimal places —
 * JPY has 0, BHD has 3, USD/EUR have 2. Callers (e.g. @fintech-portfolio/ui's formatMoney)
 * only ever receive the resulting major-unit float, never raw minor units.
 */
export function toMajorUnits({ amountMinorUnits, currency }: Money): number {
  return amountMinorUnits / 10 ** minorUnitExponent(currency);
}

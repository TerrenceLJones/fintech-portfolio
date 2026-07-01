/**
 * Formats an already-major-units amount (e.g. dollars, not cents) as a localized currency
 * string — sign is dropped; callers indicate credit/debit separately. `Intl.NumberFormat`
 * picks the correct symbol and decimal places per `currency` (e.g. 0 for JPY, 2 for USD, 3
 * for BHD) rather than assuming 2 everywhere. Converting raw minor units (cents) into this
 * major-units amount is a domain concern — see `toMajorUnits` in `@fintech-portfolio/money`.
 */
export function formatMoney(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Math.abs(amount));
}

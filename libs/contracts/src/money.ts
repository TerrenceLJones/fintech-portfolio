/** An amount in a currency's minor unit — e.g. cents for USD, whole yen for JPY, fils for BHD. */
export interface Money {
  amountMinorUnits: number;
  /** ISO 4217 currency code, e.g. 'USD', 'JPY', 'BHD'. */
  currency: string;
}

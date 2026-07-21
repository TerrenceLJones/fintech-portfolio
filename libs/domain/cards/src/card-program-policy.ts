import type { IssuancePolicy, MerchantCategoryOption, Role } from '@clearline/contracts';

/**
 * Whether a member of the given role may request a new card under the org's issuance policy (US-CW-038
 * AC-03). `everyone` lets any member request one; `managers_and_above` restricts requesting to Finance
 * Managers and Controllers. This gates the wallet's "Request a card" affordance and is re-checked
 * server-side — the client is never the boundary (US-CW-006).
 */
export function canRequestCard(role: Role, policy: IssuancePolicy): boolean {
  if (policy === 'everyone') return true;
  return role === 'finance_manager' || role === 'controller';
}

/**
 * Filter the merchant-category catalogue by a free-text query, matching either the human label or the
 * numeric MCC code (US-CW-038 AC-02) — so "office" and "5943" both resolve to Office Supplies. An empty
 * or whitespace-only query returns the whole catalogue. Label matching is a case-insensitive substring;
 * code matching is a substring of the numeric MCC.
 */
export function searchMerchantCategories(
  catalogue: readonly MerchantCategoryOption[],
  query: string,
): MerchantCategoryOption[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === '') return [...catalogue];
  return catalogue.filter(
    (category) => category.label.toLowerCase().includes(trimmed) || category.mcc.includes(trimmed),
  );
}

/** A card-program limit-validation failure, with a human message for the API's error surface. */
export interface CardProgramLimitIssue {
  message: string;
}

export type CardProgramLimitValidation = { ok: true } | { ok: false; issue: CardProgramLimitIssue };

/**
 * Coherence check for the card-program default limits (US-CW-038 AC-01). Both limits must be positive
 * integer minor units, and the per-transaction limit may not exceed the monthly limit (a per-transaction
 * ceiling above the monthly cap could never bind). Enforced server-side so an incoherent default can
 * never be persisted, independent of the UI.
 */
export function validateCardProgramLimits(limits: {
  defaultMonthlyLimitMinorUnits: number;
  defaultPerTransactionLimitMinorUnits: number;
}): CardProgramLimitValidation {
  const { defaultMonthlyLimitMinorUnits, defaultPerTransactionLimitMinorUnits } = limits;
  const positiveInt = (value: number) => Number.isInteger(value) && value > 0;
  if (
    !positiveInt(defaultMonthlyLimitMinorUnits) ||
    !positiveInt(defaultPerTransactionLimitMinorUnits)
  ) {
    return { ok: false, issue: { message: 'Limits must be positive amounts.' } };
  }
  if (defaultPerTransactionLimitMinorUnits > defaultMonthlyLimitMinorUnits) {
    return {
      ok: false,
      issue: { message: 'The per-transaction limit can’t be higher than the monthly limit.' },
    };
  }
  return { ok: true };
}

/**
 * Card Program defaults edited in Settings → Card Program (US-CW-038). These are the org-wide seed
 * values a newly issued virtual card inherits (US-CW-014 issuance): the default monthly and
 * per-transaction limits, the default allowed merchant categories, and the issuance policy that
 * governs who may request a card. Existing cards are never retroactively changed (AC-01) — only new
 * issuance reads these. Gated by `card-program:manage` (Controller/Admin/Owner).
 */

import type { Money } from './money';

/** Who may request a new card (AC-03). `everyone` = any member; `managers_and_above` = Finance Manager+. */
export type IssuancePolicy = 'everyone' | 'managers_and_above';

/**
 * A selectable merchant category on the Card Program restriction list. `code` is the stable key stored
 * on a card's `allowedMccs` and matched by the authorization gate; `mcc` is the numeric ISO 18245 code
 * and `label` the human name — both searchable (AC-02), so a Controller can find a category by typing
 * either "office" or "5943".
 */
export interface MerchantCategoryOption {
  code: string;
  /** Four-digit ISO 18245 merchant category code, e.g. '5734' for Software. */
  mcc: string;
  label: string;
}

/** GET /api/card-program — the org's current card-program defaults plus the selectable MCC catalogue. */
export interface CardProgramDefaultsResponse {
  defaultMonthlyLimit: Money;
  defaultPerTransactionLimit: Money;
  /** MCC `code`s new cards are restricted to by default; an empty list means unrestricted (AC-02). */
  defaultAllowedMccs: string[];
  issuancePolicy: IssuancePolicy;
  /** The catalogue to pick restrictions from — searchable by label or numeric code (AC-02). */
  merchantCategories: MerchantCategoryOption[];
  currency: string;
}

/** PATCH /api/card-program body — the editable card-program defaults (limits in minor units, AC-01/02/03). */
export interface UpdateCardProgramDefaultsRequest {
  defaultMonthlyLimitMinorUnits: number;
  defaultPerTransactionLimitMinorUnits: number;
  defaultAllowedMccs: string[];
  issuancePolicy: IssuancePolicy;
}

/**
 * GET /api/card-program/issuance-policy — readable by ANY authenticated user, because it gates the
 * universal "Request a card" affordance in the card wallet (AC-03). `canRequest` is computed
 * server-side from the caller's own role and the org policy, so the client never decides authority.
 */
export interface IssuancePolicyResponse {
  issuancePolicy: IssuancePolicy;
  canRequest: boolean;
}

export type CardProgramErrorCode = 'forbidden_role' | 'unauthenticated' | 'invalid_limit';

/** Body of a 4xx from the card-program endpoint — the client maps `error` to inline copy or AccessDenied. */
export interface CardProgramErrorResponse {
  error: CardProgramErrorCode;
}

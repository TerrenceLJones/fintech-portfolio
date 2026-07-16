/** Cache key for the card wallet (the full list). */
export const CARDS_QUERY_KEY = ['cards'] as const;

/** Cache key for the issuance form's context (cardholder candidates + merchant categories). */
export const CARDS_ISSUE_CONTEXT_QUERY_KEY = ['cards', 'issue-context'] as const;

/** Cache key for a single card — so the detail page and any invalidation can't drift apart. */
export function cardQueryKey(cardId: string): readonly [string, string, string] {
  return ['cards', 'detail', cardId];
}

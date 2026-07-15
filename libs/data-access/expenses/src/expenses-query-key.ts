/** Shared cache key for expense data — one place so the queries and the submit invalidation can't drift apart. */
export const EXPENSES_QUERY_KEY = ['expenses'] as const;

/** The New Expense form's context (categories + receipt threshold) is a distinct, rarely-changing read. */
export const EXPENSE_CONTEXT_QUERY_KEY = ['expenses', 'context'] as const;

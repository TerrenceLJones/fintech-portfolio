/**
 * Root key for the Billing & Plan query — updating the payment method or cancelling the subscription
 * invalidates it so the summary refetches (US-CW-042). The lightweight grace status is keyed separately
 * so any-role pages can subscribe to it without pulling the Admin/Owner-only summary.
 */
export const BILLING_QUERY_KEY = ['billing'] as const;

export const billingKeys = {
  summary: () => [...BILLING_QUERY_KEY, 'summary'] as const,
  status: () => [...BILLING_QUERY_KEY, 'status'] as const,
};

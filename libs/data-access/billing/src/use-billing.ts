import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@clearline/data-access-auth';
import type {
  BillingSummary,
  CancelSubscriptionResponse,
  SubscriptionStatus,
  UpdatePaymentMethodResponse,
} from '@clearline/contracts';
import { billingKeys } from './billing-query-keys';

/** Thrown when the caller lacks billing:manage — the page degrades to AccessDenied (AC-08). */
export class BillingForbiddenError extends Error {
  constructor() {
    super('billing_forbidden');
    this.name = 'BillingForbiddenError';
  }
}

/** Carries the server's typed billing error code + status so a form can show the specific inline copy. */
export class BillingActionError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'BillingActionError';
  }
}

async function getBilling(): Promise<BillingSummary> {
  const response = await authenticatedFetch('/api/billing');
  if (response.status === 403) throw new BillingForbiddenError();
  if (!response.ok) throw new Error('billing_fetch_failed');
  return response.json();
}

/** The org's plan/usage/payment/invoice summary for the Billing settings page — Admin/Owner only (AC-01/AC-08). */
export function useBilling() {
  return useQuery({ queryKey: billingKeys.summary(), queryFn: getBilling, retry: false });
}

async function getBillingStatus(): Promise<{
  status: SubscriptionStatus;
  accessUntil: string | null;
}> {
  const response = await authenticatedFetch('/api/billing/status');
  if (!response.ok) throw new Error('billing_status_failed');
  return response.json();
}

/**
 * The subscription status only, readable by any authenticated user — drives the app-wide post-cancellation
 * read-only grace banner (AC-07). Never 403s on role, so it can mount in the shell for every member.
 */
export function useBillingStatus() {
  return useQuery({ queryKey: billingKeys.status(), queryFn: getBillingStatus, retry: false });
}

async function send<T>(path: string, body: unknown): Promise<T> {
  const response = await authenticatedFetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new BillingActionError(payload.error ?? 'request_failed', response.status);
  }
  return response.json() as Promise<T>;
}

/** Update the card on file via a mock Stripe token (AC-02). A decline throws BillingActionError('card_declined'). */
export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentToken: string) =>
      send<UpdatePaymentMethodResponse>('/api/billing/payment-method', { paymentToken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: billingKeys.summary() }),
  });
}

/** Cancel the subscription for period-end (AC-05/AC-06). A name mismatch throws BillingActionError('name_mismatch'). */
export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (confirmationName: string) =>
      send<CancelSubscriptionResponse>('/api/billing/cancel', { confirmationName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.summary() });
      queryClient.invalidateQueries({ queryKey: billingKeys.status() });
    },
  });
}

/**
 * Download a past invoice as a period-named PDF (AC-04). Fetches the PDF as a blob and triggers a
 * browser download whose filename comes from the server's Content-Disposition, so re-downloading the
 * same invoice reuses the period-named file rather than appending "(1)".
 */
export async function downloadInvoice(invoiceId: string): Promise<void> {
  const response = await authenticatedFetch(`/api/billing/invoices/${invoiceId}/pdf`);
  if (!response.ok) throw new BillingActionError('invoice_download_failed', response.status);
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? `${invoiceId}.pdf`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

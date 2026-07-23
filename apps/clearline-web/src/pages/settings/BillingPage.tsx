import { useNavigate } from 'react-router';
import { AccessDenied, Alert, Text } from '@clearline/ui';
import { BillingForbiddenError, useBilling } from '@clearline/data-access-billing';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { ToastViewport } from '../../components/ToastViewport';
import { useToast } from '../../hooks/useToast';
import { DEFAULT_SETTINGS_SLUG, settingsPathForSlug } from '../../rbac/settings-sections';
import { billingBeacon } from './billing.beacon';
import { PlanUsageSummary } from './billing/PlanUsageSummary';
import { PaymentMethodSection } from './billing/PaymentMethodSection';
import { InvoiceHistorySection } from './billing/InvoiceHistorySection';
import { CancelSubscriptionSection } from './billing/CancelSubscriptionSection';

/**
 * Settings → Billing & Plan (US-CW-042). An Admin/Owner-only surface: the plan + usage summary with
 * amber approaching-limit indicators (AC-01), a Stripe Elements-style payment-method update where card
 * data never touches Clearline (AC-02/03), period-named invoice downloads (AC-04), and a deliberate,
 * type-the-company-name cancellation scheduled for period-end (AC-05/06). Gated by `billing:manage` —
 * the endpoint returns 403 independently and the page degrades to AccessDenied (AC-08). Once cancelled,
 * the org shows a read-only grace banner until access ends (AC-07). Every change is audited server-side,
 * never recording raw card data (AC-09).
 */
export function BillingPage() {
  useDemoBeacon(billingBeacon);
  const navigate = useNavigate();
  const query = useBilling();
  const { toast, show: showToast } = useToast(4000);

  if (query.error instanceof BillingForbiddenError) {
    return (
      <AccessDenied
        message="Ask an admin if you need it. This settings section is available to a different role."
        requestLine="403 Forbidden · GET /api/billing"
        actionLabel="Back to Personal Info"
        onAction={() => navigate(settingsPathForSlug(DEFAULT_SETTINGS_SLUG))}
      />
    );
  }

  const canceled = query.data?.status === 'canceled_grace';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Text as="h2" size="heading">
          Billing &amp; Plan
        </Text>
        <Text as="p" size="label" tone="muted" className="mt-1">
          Your plan, usage, payment method, and invoices. Cancelling keeps read-only access until
          the end of your billing period.
        </Text>
      </div>

      {query.isPending || !query.data ? (
        <Text as="p" tone="muted">
          Loading billing…
        </Text>
      ) : (
        <>
          {canceled ? (
            <Alert
              tone="warning"
              title="Your subscription was cancelled"
              message={`You have read-only access until ${query.data.accessUntil}. Export your data before then — no new transactions, cards, or approvals can be created.`}
            />
          ) : null}
          <PlanUsageSummary summary={query.data} />
          <PaymentMethodSection paymentMethod={query.data.paymentMethod} onToast={showToast} />
          <InvoiceHistorySection invoices={query.data.invoices ?? []} onToast={showToast} />
          {!canceled ? (
            <CancelSubscriptionSection companyName={query.data.companyName} onToast={showToast} />
          ) : null}
        </>
      )}

      <ToastViewport toast={toast} />
    </div>
  );
}

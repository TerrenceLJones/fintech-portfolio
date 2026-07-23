import { Icon, ProgressBar, Text } from '@clearline/ui';
import { formatMoneyValue } from '@clearline/ui';
import type { BillingSummary, UsageMetric } from '@clearline/contracts';
import { CARD } from '../security-compliance/card';

/** Usage at/above this fraction of the limit shows the amber "Approaching limit" indicator (AC-01). */
const APPROACHING = 0.8;

type UsageState = 'ok' | 'approaching' | 'reached';

function usageState(metric: UsageMetric): UsageState {
  if (metric.used >= metric.limit) return 'reached';
  if (metric.used / metric.limit >= APPROACHING) return 'approaching';
  return 'ok';
}

function UsageRow({ label, metric }: { label: string; metric: UsageMetric }) {
  const state = usageState(metric);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Text as="span" size="label" weight="semibold">
          {label}
        </Text>
        <Text as="span" size="label" tone="muted" className="tabular-nums">
          {metric.used.toLocaleString()} / {metric.limit.toLocaleString()}
        </Text>
      </div>
      <ProgressBar
        value={metric.used}
        max={metric.limit}
        tone={state === 'reached' ? 'negative' : state === 'approaching' ? 'warning' : 'accent'}
        label={`${label} usage`}
      />
      {state !== 'ok' ? (
        // Never colour-only: the state carries an icon + text badge (design §19 / AC-01).
        <span className="text-cl-warn inline-flex items-center gap-1.5">
          <Icon name="triangle-alert" size={13} />
          <Text as="span" size="label" className="text-cl-warn">
            {state === 'reached' ? 'Limit reached' : 'Approaching limit'}
          </Text>
        </span>
      ) : null}
    </div>
  );
}

/**
 * Plan + usage summary (US-CW-042 AC-01): current plan, billing cycle, next billing date, and amount
 * due, plus usage vs each plan limit. As any usage nears its limit the row carries an amber
 * "Approaching limit" indicator with an icon AND text — never colour alone. Money renders through the
 * shared minor-unit formatter, no separate billing path.
 */
export function PlanUsageSummary({ summary }: { summary: BillingSummary }) {
  const cycleLabel = summary.cycle === 'annual' ? 'Annual' : 'Monthly';
  const nextLabel = summary.status === 'canceled_grace' ? 'Access until' : 'Next billing date';
  return (
    <section className={`${CARD} flex flex-col gap-5`} aria-labelledby="plan-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Text as="h3" id="plan-heading" size="label" weight="semibold">
            {summary.planName} plan
          </Text>
          <Text as="p" tone="muted" size="label" className="mt-1">
            {cycleLabel} · {nextLabel} {summary.nextBillingDate}
          </Text>
        </div>
        <div className="text-right">
          <Text as="div" size="heading">
            {formatMoneyValue(summary.amountDue)}
          </Text>
          <Text as="div" tone="muted" size="label">
            due {summary.nextBillingDate}
          </Text>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <UsageRow label="Active members" metric={summary.usage.members} />
        <UsageRow label="Active cards" metric={summary.usage.cards} />
        <UsageRow label="Transactions this period" metric={summary.usage.transactions} />
      </div>
    </section>
  );
}

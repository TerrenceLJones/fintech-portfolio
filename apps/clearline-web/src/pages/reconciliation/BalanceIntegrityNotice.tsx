import type { BalanceIntegrityStatus } from '@clearline/contracts';
import { toMajorUnits } from '@clearline/money';
import { Icon, MoneyDisplay, Text } from '@clearline/ui';
import { PanelCard, PanelError, PanelSkeleton } from './recon-chrome';

export interface BalanceIntegrityNoticeProps {
  balance?: BalanceIntegrityStatus;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}

/** The healthy account balance — derived from a ledger that nets, so safe to show. */
function HealthyBalance({
  balance,
}: {
  balance: Extract<BalanceIntegrityStatus, { status: 'ok' }>;
}) {
  return (
    <PanelCard title="Account balance">
      <Text as="div" size="label" tone="muted" className="mb-1.5">
        {balance.accountLabel} · available balance
      </Text>
      <MoneyDisplay amount={toMajorUnits(balance.availableBalance)} state="loaded" />
    </PanelCard>
  );
}

/**
 * The Fatal-tier withheld-balance state (US-CW-016 AC-04). When the ledger's postings don't net to the
 * derived balance the number is *not shown* — a hatched placeholder stands in its place (never "$0.00"),
 * with the "we're double-checking your balance" message and a support reference for investigation. The
 * value only returns once it's trustworthy again.
 */
function WithheldBalance({
  balance,
}: {
  balance: Extract<BalanceIntegrityStatus, { status: 'integrity_failure' }>;
}) {
  return (
    <div
      className="bg-cl-surface rounded-xl border p-[18px]"
      style={{ borderColor: 'color-mix(in srgb, var(--cl-crit) 26%, transparent)' }}
      role="alert"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <Text as="div" size="label" weight="semibold" tone="default" className="mb-0">
          Account balance
        </Text>
        <span className="border-cl-crit text-cl-crit inline-flex items-center rounded-md border px-2 py-0.5">
          <Text as="span" size="label" weight="semibold" className="text-cl-crit">
            Fatal-tier
          </Text>
        </span>
      </div>

      <Text as="div" size="label" tone="muted" className="mb-1.5">
        {balance.accountLabel} · available balance
      </Text>
      {/* The balance is withheld — a hatched bar, not a number, so nothing untrustworthy is shown. */}
      <div
        className="mb-3 flex h-9 items-center rounded-md px-3"
        style={{
          background:
            'repeating-linear-gradient(135deg, var(--cl-surface-2), var(--cl-surface-2) 8px, var(--cl-inset) 8px, var(--cl-inset) 16px)',
        }}
        aria-hidden="true"
      >
        <span className="text-cl-text-3 font-mono text-sm tracking-widest">— — — —</span>
      </div>

      <div className="bg-cl-crit-weak mb-3 flex items-start gap-2.5 rounded-lg px-3.5 py-2.75">
        <Icon name="octagon-alert" size={16} className="text-cl-crit mt-0.5 shrink-0" />
        <Text as="span" size="label" weight="semibold" className="text-cl-crit">
          We're double-checking your balance. This may take a moment.
        </Text>
      </div>

      <div className="bg-cl-inset border-cl-border flex items-center justify-between rounded-lg border px-3.5 py-2.5">
        <Text as="span" size="label" tone="faint">
          Support reference
        </Text>
        <span className="text-cl-text-2 font-mono text-[13px] tracking-wide">
          {balance.supportReference}
        </span>
      </div>

      <Text as="p" size="label" tone="faint" className="mt-2.5 mb-0">
        Postings don't net to the expected derived balance. Display is paused pending investigation
        — no number is shown until it's trustworthy.
      </Text>
    </div>
  );
}

/**
 * The reconciliation account's balance panel, gated by the internal-integrity check. Renders the
 * healthy balance when postings net, and the Fatal-tier withheld state otherwise (AC-04). A fetch
 * failure is isolated to this panel with its own retry.
 */
export function BalanceIntegrityNotice({
  balance,
  isPending,
  isError,
  onRetry,
}: BalanceIntegrityNoticeProps) {
  if (isError) return <PanelError title="Account balance" onRetry={onRetry} />;
  if (isPending || !balance) {
    return (
      <PanelCard title="Account balance">
        <PanelSkeleton rows={2} />
      </PanelCard>
    );
  }
  return balance.status === 'ok' ? (
    <HealthyBalance balance={balance} />
  ) : (
    <WithheldBalance balance={balance} />
  );
}

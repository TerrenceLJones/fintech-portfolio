import { useState } from 'react';
import type { ReconciliationException, SplitPortion } from '@clearline/contracts';
import { AccessDenied, Alert, Button, Text } from '@clearline/ui';
import {
  ReconciliationForbiddenError,
  useAccountBalance,
  useConfirmMatch,
  useDismissException,
  useExceptions,
  useMatched,
  useRejectSuggestion,
  useReconciliationSummary,
  useRunReconciliation,
  useSplitMatch,
} from '@clearline/data-access-reconciliation';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { usePageTitle } from '../../hooks/usePageTitle';
import { reconciliationBeacon } from './ReconciliationPage.beacon';
import { SummaryStats } from './SummaryStats';
import { BalanceIntegrityNotice } from './BalanceIntegrityNotice';
import { ExceptionsTable } from './ExceptionsTable';
import { MatchedTable } from './MatchedTable';
import { FuzzyMatchDialog } from './FuzzyMatchDialog';
import { SplitMatchDialog } from './SplitMatchDialog';
import { PanelCard, PanelError, PanelSkeleton } from './recon-chrome';

type Tab = 'exceptions' | 'matched';
type Dialog = { exception: ReconciliationException; mode: 'fuzzy' | 'split' } | null;

/** "2026-06-29T02:00:00.000Z" → "Jun 29, 2:00 AM". Purely cosmetic — the caption under the header. */
function formatRunTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * The bank-feed reconciliation view (US-CW-016). The nightly run's headline stats sit above an
 * integrity-gated account balance and the exceptions queue: unmatched lines stay actionable (dismiss /
 * split), fuzzy suggestions are confirmed or rejected against a similarity breakdown, and a split must
 * sum exactly to the source amount. A 403 degrades to access-denied, not a broken page; each panel
 * fetches independently so one backend failure is isolated behind its own retry.
 */
export function ReconciliationPage() {
  usePageTitle('Reconciliation');
  useDemoBeacon(reconciliationBeacon);

  const summary = useReconciliationSummary();
  const exceptions = useExceptions();
  const matched = useMatched();
  const balance = useAccountBalance();
  const run = useRunReconciliation();
  const confirm = useConfirmMatch();
  const reject = useRejectSuggestion();
  const dismiss = useDismissException();
  const split = useSplitMatch();

  const [tab, setTab] = useState<Tab>('exceptions');
  const [dialog, setDialog] = useState<Dialog>(null);

  // A mid-session downgrade (or a bypassed route guard) degrades to access-denied, not a broken page.
  if (summary.error instanceof ReconciliationForbiddenError) {
    return <AccessDenied requestLine="403 Forbidden · GET /api/reconciliation/summary" />;
  }

  const summaryData = summary.data?.summary;
  const exceptionsList = exceptions.data?.exceptions ?? [];
  const matchedList = matched.data?.matched ?? [];
  const exceptionsCount = summaryData?.exceptionsCount ?? exceptionsList.length;
  const matchedCount = summaryData?.autoMatchedCount ?? matchedList.length;

  // Reset the relevant mutation when (re)opening a dialog so a prior failure never shows stale.
  const openReview = (exception: ReconciliationException) => {
    confirm.reset();
    reject.reset();
    setDialog({ exception, mode: 'fuzzy' });
  };
  const openSplit = (exception: ReconciliationException) => {
    split.reset();
    setDialog({ exception, mode: 'split' });
  };
  const closeDialog = () => setDialog(null);

  const confirmActive = () =>
    dialog && confirm.mutate(dialog.exception.id, { onSuccess: closeDialog });
  const rejectActive = () =>
    dialog && reject.mutate(dialog.exception.id, { onSuccess: closeDialog });
  const splitActive = (portions: SplitPortion[]) =>
    dialog &&
    split.mutate({ exceptionId: dialog.exception.id, portions }, { onSuccess: closeDialog });

  // A failed dismiss/run, or an ambiguous quick-match failure (which has no dialog to host the error),
  // surfaces as a dismissible page banner rather than failing silently.
  const showActionError = dismiss.isError || run.isError || (confirm.isError && !dialog);
  const clearActionError = () => {
    dismiss.reset();
    run.reset();
    if (!dialog) confirm.reset();
  };

  const runCaption = summaryData
    ? `Nightly job · ran ${formatRunTimestamp(summaryData.lastRunAt)} · ${summaryData.feedSource}`
    : 'Nightly job · Plaid bank feed';

  return (
    <div className="font-sans">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Text as="h2" size="heading" tone="default" className="mb-0.5">
            Reconciliation
          </Text>
          <Text as="p" size="label" tone="muted" className="mb-0">
            {runCaption}
          </Text>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon="refresh"
          loading={run.isPending}
          onClick={() => run.mutate()}
        >
          Run again
        </Button>
      </div>

      {showActionError ? (
        <div className="mb-3.5">
          <Alert
            tone="negative"
            title="That action didn't go through"
            message="Please try again."
            action="Dismiss"
            onAction={clearActionError}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-3.5">
        <SummaryStats
          summary={summaryData}
          isPending={summary.isPending}
          isError={summary.isError}
          onRetry={() => void summary.refetch()}
        />

        <BalanceIntegrityNotice
          balance={balance.data?.balance}
          isPending={balance.isPending}
          isError={balance.isError}
          onRetry={() => void balance.refetch()}
        />

        <div>
          <div className="mb-3 flex gap-2" role="tablist" aria-label="Reconciliation view">
            <Button
              variant={tab === 'exceptions' ? 'secondary' : 'ghost'}
              size="sm"
              role="tab"
              id="recon-tab-exceptions"
              aria-selected={tab === 'exceptions'}
              aria-controls="recon-panel"
              onClick={() => setTab('exceptions')}
            >
              Exceptions ({exceptionsCount})
            </Button>
            <Button
              variant={tab === 'matched' ? 'secondary' : 'ghost'}
              size="sm"
              role="tab"
              id="recon-tab-matched"
              aria-selected={tab === 'matched'}
              aria-controls="recon-panel"
              onClick={() => setTab('matched')}
            >
              Matched ({matchedCount})
            </Button>
          </div>

          <div
            role="tabpanel"
            id="recon-panel"
            aria-labelledby={tab === 'exceptions' ? 'recon-tab-exceptions' : 'recon-tab-matched'}
          >
            {tab === 'exceptions' ? (
              <PanelCard title="Exceptions">
                {exceptions.isError ? (
                  <PanelError title="Exceptions" onRetry={() => void exceptions.refetch()} />
                ) : exceptions.isPending ? (
                  <PanelSkeleton rows={4} />
                ) : (
                  <ExceptionsTable
                    exceptions={exceptionsList}
                    onReview={openReview}
                    onSplit={openSplit}
                    onConfirm={(id) => confirm.mutate(id)}
                    onDismiss={(id) => dismiss.mutate(id)}
                    dismissingId={dismiss.isPending ? (dismiss.variables as string) : undefined}
                    confirmingId={
                      confirm.isPending && !dialog ? (confirm.variables as string) : undefined
                    }
                  />
                )}
              </PanelCard>
            ) : (
              <PanelCard title="Matched">
                {matched.isError ? (
                  <PanelError title="Matched" onRetry={() => void matched.refetch()} />
                ) : matched.isPending ? (
                  <PanelSkeleton rows={4} />
                ) : (
                  <MatchedTable matched={matchedList} totalMatched={matchedCount} />
                )}
              </PanelCard>
            )}
          </div>
        </div>
      </div>

      {dialog?.mode === 'fuzzy' ? (
        <FuzzyMatchDialog
          exception={dialog.exception}
          open
          onClose={closeDialog}
          onConfirm={() => confirmActive()}
          onReject={() => rejectActive()}
          isConfirming={confirm.isPending}
          isRejecting={reject.isPending}
          hasError={confirm.isError || reject.isError}
        />
      ) : null}

      {dialog?.mode === 'split' ? (
        <SplitMatchDialog
          exception={dialog.exception}
          open
          onClose={closeDialog}
          onSplit={(portions) => splitActive(portions)}
          isSplitting={split.isPending}
          hasError={split.isError}
        />
      ) : null}
    </div>
  );
}

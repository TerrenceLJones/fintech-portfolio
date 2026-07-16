import {
  AccessDenied,
  Alert,
  Button,
  Text,
  TextField,
  VirtualCard,
  formatMoneyValue,
} from '@clearline/ui';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { usePageTitle } from '../../hooks/usePageTitle';
import { issueCardBeacon } from './IssueCardPage.beacon';
import { useIssueCardForm } from './issue-card/use-issue-card-form';
import { CardholderPicker } from './issue-card/CardholderPicker';
import { MccChipSelector } from './issue-card/MccChipSelector';

/** Copy for each issuance rejection the server can return, mapped to the card error code. */
const ISSUE_ERROR_COPY: Record<string, string> = {
  invalid_limit: 'Enter a monthly limit greater than $0.00.',
  invalid_holder: 'Choose a cardholder for this card.',
  forbidden: 'You no longer have permission to issue cards.',
  card_not_found: 'Something went wrong issuing this card. Try again.',
};

/**
 * Card issuance (US-CW-014 AC-01) — a Controller-only screen (gated by cards:manage). A two-panel
 * layout: the form on the left (cardholder, monthly limit, MCC restrictions) and a live preview on the
 * right. On success the new card is issued, audited with its limits, and opens its live feed.
 */
export function IssueCardPage() {
  usePageTitle('Issue card');
  useDemoBeacon(issueCardBeacon);
  const form = useIssueCardForm();

  if (form.forbidden) {
    return <AccessDenied requestLine="403 Forbidden · GET /api/cards/context" />;
  }

  const limitLabel =
    form.limitMinorUnits != null
      ? formatMoneyValue({ amountMinorUnits: form.limitMinorUnits, currency: 'USD' })
      : '$0.00';

  return (
    <div className="font-sans">
      <div className="border-cl-border bg-cl-surface overflow-hidden rounded-xl border md:flex">
        {/* ── Left: the issuance form ─────────────────────────────────────── */}
        <div className="flex-[1.2] p-6">
          <Text as="h2" size="heading" weight="semibold" className="mb-1">
            New virtual card
          </Text>
          <Text as="p" size="label" tone="muted" className="mb-5">
            Set a monthly limit and merchant-category restrictions. Creation is recorded in the
            audit log.
          </Text>

          {form.isLoadingContext ? (
            <Text as="p" size="label" tone="muted">
              Loading…
            </Text>
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <Text as="div" size="label" tone="muted" className="mb-1.5">
                  Cardholder
                </Text>
                <CardholderPicker
                  candidates={form.candidates}
                  selectedId={form.holderId}
                  onSelect={form.selectHolder}
                />
              </div>

              <TextField
                label="Monthly limit"
                prefix="$"
                inputMode="decimal"
                placeholder="2,000.00"
                value={form.limitInput}
                onChange={(event) => form.setLimitInput(event.target.value)}
              />

              <div>
                <Text as="div" size="label" tone="muted" className="mb-1.5">
                  Allowed merchant categories (MCC)
                </Text>
                <MccChipSelector
                  categories={form.categories}
                  selected={form.selectedMccs}
                  onToggle={form.toggleMcc}
                />
              </div>

              {form.error ? (
                <Alert
                  tone="negative"
                  title="Couldn’t issue this card"
                  message={ISSUE_ERROR_COPY[form.error.code] ?? 'Something went wrong. Try again.'}
                />
              ) : null}
            </div>
          )}
        </div>

        {/* ── Right: live preview ─────────────────────────────────────────── */}
        <div className="border-cl-border bg-cl-inset flex flex-[0.9] flex-col gap-4 border-t p-6 md:border-t-0 md:border-l">
          <Text as="div" size="label" tone="faint" weight="semibold">
            Preview
          </Text>
          <VirtualCard
            holder={
              form.selectedHolder
                ? `${form.selectedHolder.name} — ${form.selectedHolder.team}`
                : 'New cardholder'
            }
            last4="••••"
            exp="09/28"
            state="active"
          />
          <div className="flex items-center justify-between">
            <Text as="span" size="label" tone="faint">
              Issues on save
            </Text>
            <Text as="span" size="mono" weight="semibold" tone="default">
              {limitLabel} / mo
            </Text>
          </div>
          <Button
            fullWidth
            onClick={form.submit}
            disabled={!form.canSubmit}
            loading={form.isSubmitting}
          >
            Issue card
          </Button>
        </div>
      </div>
    </div>
  );
}

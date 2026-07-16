import type { DateRange } from '@clearline/contracts';
import { Button, Icon, Text } from '@clearline/ui';
import type { DateRangeValidation } from '@clearline/data-access-analytics';

export interface DateRangeFilterProps {
  draft: DateRange;
  validation: DateRangeValidation;
  isDirty: boolean;
  onChange: (draft: DateRange) => void;
  onApply: () => void;
}

const FIELD_CLASS =
  'border-cl-border-2 bg-cl-surface text-cl-text font-mono focus:border-cl-accent focus:ring-cl-accent-weak rounded-lg border px-2.5 py-2 text-[12.5px] focus:ring-2 focus:outline-none';

/**
 * The custom date-range filter (US-CW-015 AC-04). The Apply action is disabled while the draft is
 * invalid or unchanged, and an end-before-start draft shows the inline error "End date must be after
 * the start date." — the range is never applied (never refetched) until corrected. The invalid field
 * is marked `aria-invalid` and wired to the message via `aria-describedby`.
 */
export function DateRangeFilter({
  draft,
  validation,
  isDirty,
  onChange,
  onApply,
}: DateRangeFilterProps) {
  const invalid = !validation.valid && Boolean(validation.error);
  const errorId = 'date-range-error';

  return (
    <div className="border-cl-border bg-cl-surface rounded-xl border p-3.5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <Text as="span" size="label" tone="muted" weight="medium">
            Start date
          </Text>
          <input
            type="date"
            className={FIELD_CLASS}
            aria-label="Start date"
            value={draft.from}
            onChange={(e) => onChange({ ...draft, from: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <Text as="span" size="label" tone="muted" weight="medium">
            End date
          </Text>
          <input
            type="date"
            className={FIELD_CLASS}
            aria-label="End date"
            aria-invalid={invalid}
            aria-describedby={invalid ? errorId : undefined}
            value={draft.to}
            onChange={(e) => onChange({ ...draft, to: e.target.value })}
          />
        </label>
        <Button size="sm" disabled={!validation.valid || !isDirty} onClick={onApply}>
          Apply range
        </Button>
      </div>
      {invalid ? (
        <div id={errorId} className="mt-2.5 flex items-center gap-1.5" role="alert">
          <Icon name="x-circle" size={14} className="text-cl-neg shrink-0" />
          <Text as="span" size="label" tone="critical" weight="medium">
            {validation.error}
          </Text>
        </div>
      ) : null}
    </div>
  );
}

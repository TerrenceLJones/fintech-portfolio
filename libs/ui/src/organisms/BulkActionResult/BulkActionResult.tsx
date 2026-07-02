import { Icon } from '@fintech-portfolio/icons';
import { Button } from '../../atoms/Button';

export interface BulkActionFailure {
  name: string;
  reason: string;
}

export interface BulkActionResultProps {
  total: number;
  succeeded?: number;
  failures?: BulkActionFailure[];
  onRetry?: () => void;
}

/** Partial-failure summary — successes are committed and stay committed; failures stay visible with per-row reasons and a retry-failed-only action (no all-or-nothing rollback). */
export function BulkActionResult({
  total,
  succeeded,
  failures = [],
  onRetry,
}: BulkActionResultProps) {
  const failCount = failures.length;
  const succeededCount = succeeded ?? total - failCount;

  return (
    <div className="border-cl-border overflow-hidden rounded-xl border font-sans">
      <div className="bg-cl-warn-weak border-cl-warn/24 flex items-start gap-2.75 border-b px-4 py-4">
        <Icon name="triangle-alert" size={18} className="text-cl-warn mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-cl-text text-[13.5px] font-semibold">
            {succeededCount} of {total} approved. {failCount} couldn&rsquo;t be processed &mdash;
            review and retry.
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={onRetry} className="flex-shrink-0">
          Retry failed ({failCount})
        </Button>
      </div>
      {failures.map((failure, i) => (
        <div
          key={failure.name}
          className={[
            'flex items-center justify-between px-4 py-3 text-xs',
            i < failures.length - 1 ? 'border-cl-border border-b' : '',
          ].join(' ')}
        >
          <span className="text-cl-neg flex items-center gap-1.5 font-semibold">
            <Icon name="x-circle" size={13} />
            {failure.name}
          </span>
          <span className="text-cl-text-2">{failure.reason}</span>
        </div>
      ))}
    </div>
  );
}

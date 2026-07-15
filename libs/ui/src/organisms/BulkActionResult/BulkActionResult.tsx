import { Icon } from '../../foundations/Icon';
import { Button } from '../../atoms/Button';
import { Text } from '../../atoms/Text';

export interface BulkActionFailure {
  name: string;
  reason: string;
}

export interface BulkActionResultProps {
  total: number;
  succeeded?: number;
  failures?: BulkActionFailure[];
  /**
   * Names the connection dropped before the server confirmed them (US-CW-013 AC-03). When present the
   * component switches to its network-failure view: the confirmed items stay committed and only these
   * are offered for a resume.
   */
  notProcessed?: string[];
  /** Names of the confirmed items, listed beside the unprocessed column in the network-failure view. */
  confirmed?: string[];
  onRetry?: () => void;
}

/** Shows the first few names, then "+ N more" — the roster can be long after a large batch. */
function NameList({ names }: { names: string[] }) {
  const shown = names.slice(0, 3);
  const remaining = names.length - shown.length;
  return (
    <div className="text-cl-text-2 text-[13px] leading-relaxed">
      {shown.map((name) => (
        <div key={name}>{name}</div>
      ))}
      {remaining > 0 ? <div className="text-cl-text-3">+ {remaining} more</div> : null}
    </div>
  );
}

/**
 * The result of a bulk approve/reject. Two shapes, one guarantee — successes are committed and stay
 * committed:
 *   - Partial failure: a warning banner summarising N of M approved, each failure visible with its
 *     reason, and a retry-failed-only action (design §7.2, no all-or-nothing rollback).
 *   - Mid-batch connection drop: a distinct negative banner naming how many were confirmed before the
 *     drop, with the confirmed and "not yet processed" items split into two columns and a resume that
 *     retries only the unprocessed tail (US-CW-013 AC-03).
 */
export function BulkActionResult({
  total,
  succeeded,
  failures = [],
  notProcessed = [],
  confirmed = [],
  onRetry,
}: BulkActionResultProps) {
  if (notProcessed.length > 0) {
    const confirmedCount = succeeded ?? confirmed.length;
    return (
      <div className="border-cl-border overflow-hidden rounded-xl border font-sans">
        <div className="bg-cl-neg-weak border-cl-neg/24 flex items-start gap-2.75 border-b px-4 py-4">
          <Icon name="triangle-alert" size={18} className="text-cl-neg mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <Text as="div" size="body" weight="semibold" tone="default">
              Connection lost mid-batch. {confirmedCount} of {total} were confirmed.
            </Text>
            <Text as="div" size="label" tone="muted">
              The remaining {notProcessed.length} weren&rsquo;t processed &mdash; resume to retry
              only those.
            </Text>
          </div>
          <Button variant="primary" size="sm" onClick={onRetry} className="flex-shrink-0">
            Retry {notProcessed.length} unprocessed
          </Button>
        </div>
        <div className="grid grid-cols-2">
          <div className="border-cl-border border-r px-4 py-3.5">
            <Text
              as="div"
              size="label"
              weight="semibold"
              tone="positive"
              className="mb-2.5 flex items-center gap-1.5"
            >
              <Icon name="check" size={14} />
              {confirmedCount} approved
            </Text>
            <NameList names={confirmed} />
          </div>
          <div className="px-4 py-3.5">
            <Text
              as="div"
              size="label"
              weight="semibold"
              tone="muted"
              className="mb-2.5 flex items-center gap-1.5"
            >
              <Icon name="clock" size={14} />
              {notProcessed.length} not yet processed
            </Text>
            <NameList names={notProcessed} />
          </div>
        </div>
      </div>
    );
  }

  const failCount = failures.length;
  const succeededCount = succeeded ?? total - failCount;

  return (
    <div className="border-cl-border overflow-hidden rounded-xl border font-sans">
      <div className="bg-cl-warn-weak border-cl-warn/24 flex items-start gap-2.75 border-b px-4 py-4">
        <Icon name="triangle-alert" size={18} className="text-cl-warn mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <Text as="div" size="body" weight="semibold" tone="default">
            {succeededCount} of {total} approved. {failCount} couldn&rsquo;t be processed &mdash;
            review and retry.
          </Text>
        </div>
        <Button variant="primary" size="sm" onClick={onRetry} className="flex-shrink-0">
          Retry failed ({failCount})
        </Button>
      </div>
      {failures.map((failure, i) => (
        <div
          key={failure.name}
          className={[
            'flex items-center justify-between px-4 py-3',
            i < failures.length - 1 ? 'border-cl-border border-b' : '',
          ].join(' ')}
        >
          <Text
            as="span"
            size="label"
            weight="semibold"
            tone="negative"
            className="flex items-center gap-1.5"
          >
            <Icon name="x-circle" size={13} />
            {failure.name}
          </Text>
          <Text as="span" size="label" weight="regular" tone="muted">
            {failure.reason}
          </Text>
        </div>
      ))}
    </div>
  );
}

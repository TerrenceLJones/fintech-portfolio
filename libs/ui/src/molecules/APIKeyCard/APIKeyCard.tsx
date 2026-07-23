import { Icon } from '../../foundations/Icon';
import { Text } from '../../atoms/Text';
import { Button } from '../../atoms/Button';

export interface APIKeyCardProps {
  name: string;
  /** The masked key form, e.g. `sk_live_••••••••••••••ab3f` — never the full key (US-CW-041 AC-02). */
  maskedKey: string;
  scopes: string[];
  /** ISO creation timestamp. */
  createdAt: string;
  /** ISO last-use timestamp, or null for a key that has never authenticated a request. */
  lastUsedAt: string | null;
  /** Revoke handler. Omit to render a key with no revoke affordance (e.g. a read-only preview). */
  onRevoke?: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * A single API key row (design §19.3): its name over the masked key, the granted scopes as monospace
 * pills, a created / last-used footer, and — when revocable — a destructive Revoke button. Purely
 * presentational; the full key is never a prop here, only its masked form (AC-02). The masking and the
 * reveal-once flow live upstream.
 */
export function APIKeyCard({
  name,
  maskedKey,
  scopes,
  createdAt,
  lastUsedAt,
  onRevoke,
}: APIKeyCardProps) {
  return (
    <div className="border-cl-border bg-cl-surface rounded-xl border px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="bg-cl-surface-2 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <Icon name="lock" size={15} className="text-cl-text-2" />
          </div>
          <div className="min-w-0">
            <Text as="p" size="label" weight="semibold" tone="default">
              {name}
            </Text>
            <Text as="p" size="mono" tone="muted" className="mt-0.5 break-all">
              {maskedKey}
            </Text>
          </div>
        </div>
        {onRevoke ? (
          <Button size="sm" variant="danger" icon="x-circle" label="Revoke" onClick={onRevoke} />
        ) : null}
      </div>

      {scopes.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {scopes.map((scope) => (
            <span
              key={scope}
              className="bg-cl-accent-weak text-cl-accent-text rounded-md px-2 py-1 font-mono text-[11px] leading-none"
            >
              {scope}
            </span>
          ))}
        </div>
      ) : null}

      <div className="border-cl-border text-cl-text-3 mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2.5">
        <Text as="span" size="label" weight="regular" tone="faint">
          Created {formatDate(createdAt)}
        </Text>
        <Text as="span" size="label" weight="regular" tone="faint">
          {lastUsedAt ? `Last used ${formatDate(lastUsedAt)}` : 'Never used'}
        </Text>
      </div>
    </div>
  );
}

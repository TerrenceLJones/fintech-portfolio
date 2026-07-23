import { Button, StatusBadge, Text } from '@clearline/ui';
import { retryScheduleText } from '@clearline/domain-developer';
import type { WebhookDelivery } from '@clearline/contracts';

export interface WebhookDeliveryLogProps {
  deliveries: WebhookDelivery[];
  /** Fired with the delivery id when Resend is clicked (AC-09). */
  onResend: (deliveryId: string) => void;
  resendingId: string | null;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${Math.round(ms / 1000)} s` : `${ms} ms`;
}

/**
 * The delivery log for one webhook (AC-08/09). Each row shows event, HTTP status (a glyph + the number
 * via StatusBadge — never colour alone), timestamp, and duration. A non-2xx delivery gets a Resend
 * button and the documented retry-schedule note.
 */
export function WebhookDeliveryLog({ deliveries, onResend, resendingId }: WebhookDeliveryLogProps) {
  if (deliveries.length === 0) {
    return (
      <Text as="p" size="label" tone="muted">
        No deliveries yet.
      </Text>
    );
  }

  const hasFailure = deliveries.some((delivery) => !delivery.ok);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr className="text-cl-text-3 text-left font-mono text-[10px] uppercase">
              <th className="py-1 pr-3 font-medium">Event</th>
              <th className="py-1 pr-3 font-medium">Status</th>
              <th className="py-1 pr-3 font-medium">Timestamp</th>
              <th className="py-1 pr-3 font-medium">Duration</th>
              <th className="py-1 font-medium" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {deliveries.map((delivery) => (
              <tr key={delivery.id} className="border-cl-border border-t align-middle">
                <td className="py-2 pr-3">
                  <Text as="span" size="mono">
                    {delivery.eventType}
                    {delivery.resent ? <span className="text-cl-text-3"> · resent</span> : null}
                  </Text>
                </td>
                <td className="py-2 pr-3">
                  <StatusBadge
                    status={delivery.ok ? 'approved' : 'rejected'}
                    label={String(delivery.httpStatus)}
                  />
                </td>
                <td className="py-2 pr-3">
                  <Text as="span" size="label" tone="muted">
                    {formatTimestamp(delivery.deliveredAt)}
                  </Text>
                </td>
                <td className="py-2 pr-3">
                  <Text as="span" size="label" tone="muted">
                    {formatDuration(delivery.durationMs)}
                  </Text>
                </td>
                <td className="py-2">
                  {delivery.ok ? null : (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon="refresh"
                      label="Resend"
                      loading={resendingId === delivery.id}
                      onClick={() => onResend(delivery.id)}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasFailure ? (
        <Text as="p" size="label" tone="muted">
          {retryScheduleText()}
        </Text>
      ) : null}
    </div>
  );
}

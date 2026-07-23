import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, ConfirmationDialog, RevealSecretModal, StatusBadge, Text } from '@clearline/ui';
import {
  DEVELOPER_QUERY_KEY,
  useCreateWebhook,
  useDeleteWebhook,
  useResendDelivery,
} from '@clearline/data-access-developer';
import type { WebhookEventType, WebhookSummary } from '@clearline/contracts';
import { CreateWebhookDialog } from './CreateWebhookDialog';
import { WebhookDeliveryLog } from './WebhookDeliveryLog';
import { HmacReference } from './HmacReference';

export interface WebhooksSectionProps {
  webhooks: WebhookSummary[];
  onToast: (message: string) => void;
}

interface RevealedSecret {
  url: string;
  secret: string;
}

/**
 * The webhooks section (AC-06/07/08/09): the empty state + Add CTA, each endpoint with its events,
 * delivery log (with Resend + retry schedule), and HMAC verification reference; the reveal-once signing
 * secret modal shown on creation; and a §19.9 named-consequence delete confirmation.
 */
export function WebhooksSection({ webhooks, onToast }: WebhooksSectionProps) {
  const queryClient = useQueryClient();
  const createWebhook = useCreateWebhook();
  const deleteWebhook = useDeleteWebhook();
  const resendDelivery = useResendDelivery();

  const [createOpen, setCreateOpen] = useState(false);
  const [revealed, setRevealed] = useState<RevealedSecret | null>(null);
  const [deleting, setDeleting] = useState<WebhookSummary | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: DEVELOPER_QUERY_KEY });

  function handleCreate(url: string, events: WebhookEventType[]) {
    createWebhook.mutate(
      { url, events },
      {
        onSuccess: (result) => {
          setCreateOpen(false);
          setRevealed({ url: result.webhook.url, secret: result.signingSecret });
        },
      },
    );
  }

  function confirmDelete() {
    if (!deleting) return;
    const url = deleting.url;
    deleteWebhook.mutate(deleting.id, { onSuccess: () => onToast(`Deleted webhook ${url}`) });
    setDeleting(null);
  }

  function handleResend(webhookId: string, deliveryId: string) {
    resendDelivery.mutate(
      { webhookId, deliveryId },
      { onSuccess: () => onToast('Delivery resent') },
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Text as="h3" size="body" weight="semibold">
          Webhooks
        </Text>
        <Button
          size="sm"
          variant="primary"
          icon="plus"
          label="Add endpoint"
          onClick={() => setCreateOpen(true)}
        />
      </div>

      {webhooks.length === 0 ? (
        <div className="border-cl-border bg-cl-surface flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
          <Text as="p" size="label" tone="muted">
            No webhooks yet. Add an HTTPS endpoint to receive Clearline events.
          </Text>
          <Button
            size="sm"
            variant="secondary"
            icon="plus"
            label="Add endpoint"
            onClick={() => setCreateOpen(true)}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="border-cl-border bg-cl-surface flex flex-col gap-4 rounded-xl border px-5 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Text as="p" size="mono" className="break-all">
                    {webhook.url}
                  </Text>
                  <Text as="p" size="label" tone="muted" className="mt-0.5">
                    {webhook.events.length} event{webhook.events.length === 1 ? '' : 's'} ·{' '}
                    {webhook.events.join(', ')}
                  </Text>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status="active" />
                  <Button
                    size="sm"
                    variant="danger"
                    icon="x-circle"
                    label="Delete"
                    onClick={() => setDeleting(webhook)}
                  />
                </div>
              </div>

              <WebhookDeliveryLog
                deliveries={webhook.deliveries}
                resendingId={
                  resendDelivery.isPending ? (resendDelivery.variables?.deliveryId ?? null) : null
                }
                onResend={(deliveryId) => handleResend(webhook.id, deliveryId)}
              />

              <HmacReference />
            </div>
          ))}
        </div>
      )}

      <CreateWebhookDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        submitting={createWebhook.isPending}
      />

      {revealed ? (
        <RevealSecretModal
          open
          // onOpenChange(false) is the universal close signal — fired by "done", Escape, and overlay
          // click alike — so cleanup + the list refetch live here once, not also in onDone.
          onOpenChange={(open) => {
            if (!open) {
              setRevealed(null);
              invalidate();
            }
          }}
          title="Copy your signing secret"
          context={`Webhook ${revealed.url} was created.`}
          secret={revealed.secret}
          warning="This secret is shown once. Use it to verify that webhook events are from Clearline."
          onDone={() => {}}
        />
      ) : null}

      <ConfirmationDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={deleting ? `Delete webhook ${deleting.url}?` : 'Delete webhook?'}
        body="Clearline stops sending events to this endpoint immediately. This can't be undone; you would need to add the endpoint again and store a new signing secret."
        confirmLabel="Delete endpoint"
        countdown={0}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

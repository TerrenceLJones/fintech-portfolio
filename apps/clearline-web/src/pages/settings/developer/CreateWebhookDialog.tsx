import { useState } from 'react';
import { Button, Checkbox, Modal, Text, TextField } from '@clearline/ui';
import { WEBHOOK_EVENT_TYPES, isHttpsWebhookUrl } from '@clearline/domain-developer';
import type { WebhookEventType } from '@clearline/contracts';

export interface CreateWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs the create mutation with the entered HTTPS URL + selected events (AC-06). */
  onSubmit: (url: string, events: WebhookEventType[]) => void;
  submitting: boolean;
}

/**
 * The "Add endpoint" form (AC-06/07): an HTTPS endpoint URL and at least one event. A non-HTTPS URL
 * shows the inline error "Webhook endpoints must use HTTPS." and blocks Save; the server independently
 * rejects non-HTTPS too. On success the parent reveals the signing secret once.
 */
export function CreateWebhookDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: CreateWebhookDialogProps) {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<WebhookEventType[]>([]);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setUrl('');
      setEvents([]);
    }
  }

  const toggle = (event: WebhookEventType, on: boolean) =>
    setEvents((current) => (on ? [...current, event] : current.filter((e) => e !== event)));

  const trimmed = url.trim();
  // Only surface the HTTPS error once the user has typed something — an empty field isn't an error yet.
  const urlError = trimmed.length > 0 && !isHttpsWebhookUrl(trimmed);
  const canSave = isHttpsWebhookUrl(trimmed) && events.length > 0 && !submitting;

  return (
    <Modal open={open} onOpenChange={onOpenChange} maxWidth={480}>
      <Modal.Title asChild>
        <Text as="h2" size="heading" className="mb-1">
          Add webhook endpoint
        </Text>
      </Modal.Title>
      <Modal.Description asChild>
        <Text as="p" size="label" tone="muted" className="mb-4">
          Clearline will POST subscribed events to this URL. The signing secret is shown once after
          creation.
        </Text>
      </Modal.Description>

      <TextField
        label="Endpoint URL"
        placeholder="https://api.example.com/clearline/webhooks"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        state={urlError ? 'error' : 'default'}
        error={urlError ? 'Webhook endpoints must use HTTPS.' : undefined}
      />

      <Text as="p" size="label" tone="muted" className="mt-4 mb-2">
        Events
      </Text>
      <div className="flex flex-col gap-2.5">
        {WEBHOOK_EVENT_TYPES.map((option) => (
          <label key={option.event} className="flex cursor-pointer items-start gap-2.5">
            <Checkbox
              checked={events.includes(option.event)}
              onCheckedChange={(on) => toggle(option.event, on)}
              aria-label={option.label}
            />
            <span className="min-w-0">
              <Text as="span" size="label" weight="medium" className="font-mono">
                {option.event}
              </Text>
              <Text as="p" size="label" tone="muted">
                {option.description}
              </Text>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-6 flex gap-2.5">
        <Modal.Close asChild>
          <Button variant="secondary" fullWidth label="Cancel" />
        </Modal.Close>
        <Button
          variant="primary"
          fullWidth
          label="Save"
          loading={submitting}
          disabled={!canSave}
          onClick={() => onSubmit(trimmed, events)}
        />
      </div>
    </Modal>
  );
}

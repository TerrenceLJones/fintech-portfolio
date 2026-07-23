import { useState } from 'react';
import { Button, Checkbox, Modal, Text, TextField } from '@clearline/ui';
import { API_KEY_SCOPES } from '@clearline/domain-developer';
import type { ApiKeyScope } from '@clearline/contracts';

export interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs the create mutation with the entered name + selected scopes (AC-01). */
  onSubmit: (name: string, scopes: ApiKeyScope[]) => void;
  submitting: boolean;
}

/**
 * The "Create new key" form (AC-01): a name and at least one least-privilege scope. Create stays
 * disabled until both are provided. On submit the parent runs the mutation and, on success, opens the
 * reveal-once modal with the returned plaintext.
 */
export function CreateApiKeyDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: CreateApiKeyDialogProps) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiKeyScope[]>([]);

  // Reset the form on each open transition so a re-opened dialog is never pre-filled from last time.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName('');
      setScopes([]);
    }
  }

  const toggle = (scope: ApiKeyScope, on: boolean) =>
    setScopes((current) => (on ? [...current, scope] : current.filter((s) => s !== scope)));

  const canCreate = name.trim().length > 0 && scopes.length > 0 && !submitting;

  return (
    <Modal open={open} onOpenChange={onOpenChange} maxWidth={480}>
      <Modal.Title asChild>
        <Text as="h2" size="heading" className="mb-1">
          Create new key
        </Text>
      </Modal.Title>
      <Modal.Description asChild>
        <Text as="p" size="label" tone="muted" className="mb-4">
          Name the key and grant only the scopes it needs. The full key is shown once after
          creation.
        </Text>
      </Modal.Description>

      <TextField
        label="Key name"
        placeholder="Production — Read Only"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />

      <Text as="p" size="label" tone="muted" className="mt-4 mb-2">
        Scopes
      </Text>
      <div className="flex flex-col gap-2.5">
        {API_KEY_SCOPES.map((option) => (
          <label key={option.scope} className="flex cursor-pointer items-start gap-2.5">
            <Checkbox
              checked={scopes.includes(option.scope)}
              onCheckedChange={(on) => toggle(option.scope, on)}
              aria-label={option.label}
            />
            <span className="min-w-0">
              <Text as="span" size="label" weight="medium" className="font-mono">
                {option.scope}
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
          label="Create"
          loading={submitting}
          disabled={!canCreate}
          onClick={() => onSubmit(name.trim(), scopes)}
        />
      </div>
    </Modal>
  );
}

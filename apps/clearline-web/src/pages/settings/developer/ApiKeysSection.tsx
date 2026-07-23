import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { APIKeyCard, Button, ConfirmationDialog, RevealSecretModal, Text } from '@clearline/ui';
import {
  DEVELOPER_QUERY_KEY,
  useCreateApiKey,
  useRevokeApiKey,
} from '@clearline/data-access-developer';
import type { ApiKeyScope, ApiKeySummary } from '@clearline/contracts';
import { CreateApiKeyDialog } from './CreateApiKeyDialog';
import { ApiKeyUsageReference } from './ApiKeyUsageReference';

export interface ApiKeysSectionProps {
  apiKeys: ApiKeySummary[];
  onToast: (message: string) => void;
}

/** A minted key held only until its reveal-once modal is dismissed. */
interface RevealedKey {
  name: string;
  secret: string;
}

/**
 * The API keys section (AC-01/02/04/05): the empty state + Create CTA, the list of masked keys, the
 * reveal-once modal shown once on creation, and a §19.9 named-consequence revoke confirmation. On
 * reveal dismissal the developer query is invalidated so the new (masked) key appears.
 */
export function ApiKeysSection({ apiKeys, onToast }: ApiKeysSectionProps) {
  const queryClient = useQueryClient();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  const [createOpen, setCreateOpen] = useState(false);
  const [revealed, setRevealed] = useState<RevealedKey | null>(null);
  const [revoking, setRevoking] = useState<ApiKeySummary | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: DEVELOPER_QUERY_KEY });

  function handleCreate(name: string, scopes: ApiKeyScope[]) {
    createKey.mutate(
      { name, scopes },
      {
        onSuccess: (result) => {
          setCreateOpen(false);
          setRevealed({ name: result.key.name, secret: result.plaintextKey });
        },
      },
    );
  }

  function confirmRevoke() {
    if (!revoking) return;
    const name = revoking.name;
    revokeKey.mutate(revoking.id, { onSuccess: () => onToast(`Revoked "${name}"`) });
    setRevoking(null);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Text as="h3" size="body" weight="semibold">
          API keys
        </Text>
        <Button
          size="sm"
          variant="primary"
          icon="plus"
          label="Create new key"
          onClick={() => setCreateOpen(true)}
        />
      </div>

      {apiKeys.length === 0 ? (
        <div className="border-cl-border bg-cl-surface flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
          <Text as="p" size="label" tone="muted">
            No API keys yet. Create a key to access the Clearline API programmatically.
          </Text>
          <Button
            size="sm"
            variant="secondary"
            icon="plus"
            label="Create new key"
            onClick={() => setCreateOpen(true)}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {apiKeys.map((key) => (
            <APIKeyCard
              key={key.id}
              name={key.name}
              maskedKey={key.maskedKey}
              scopes={key.scopes}
              createdAt={key.createdAt}
              lastUsedAt={key.lastUsedAt}
              onRevoke={() => setRevoking(key)}
            />
          ))}
        </div>
      )}

      <ApiKeyUsageReference />

      <CreateApiKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        submitting={createKey.isPending}
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
          title="Copy your API key"
          context={`Key "${revealed.name}" was created.`}
          secret={revealed.secret}
          warning="This is the only time you'll see this key. Copy it now and store it securely."
          onDone={() => {}}
        />
      ) : null}

      <ConfirmationDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open) setRevoking(null);
        }}
        title={revoking ? `Revoke "${revoking.name}"?` : 'Revoke key?'}
        body="Any system using this key will immediately lose access — in-flight requests start receiving 401 errors. This can't be undone; a replacement key must be created."
        confirmLabel="Revoke key"
        countdown={0}
        onConfirm={confirmRevoke}
      />
    </section>
  );
}

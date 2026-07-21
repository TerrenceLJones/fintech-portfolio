import { useMemo, useState } from 'react';
import { Button, Icon, Modal, Select, Text } from '@clearline/ui';
import type { GlMappingResponse, IntegrationProvider } from '@clearline/contracts';
import { useGlMapping, useUpdateGlMapping } from '@clearline/data-access-integrations';

export interface GlMappingDialogProps {
  provider: IntegrationProvider | null;
  providerName: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (message: string) => void;
}

const NOT_MAPPED = '';

/**
 * Configure the provider's GL mapping (US-CW-039 AC-02). Clearline expense categories on the left, a
 * chart-of-accounts selector on the right. An unmapped category shows "Not mapped" highlighted amber,
 * signalling those transactions would be skipped (a Partial sync) until resolved (AC-05). Buffered
 * locally and saved as one PUT.
 */
export function GlMappingDialog({
  provider,
  providerName,
  onOpenChange,
  onSaved,
}: GlMappingDialogProps) {
  const open = provider !== null;
  const query = useGlMapping(provider ?? 'quickbooks', open);
  const update = useUpdateGlMapping();
  const [draft, setDraft] = useState<Record<string, string>>({});

  // Seed the local buffer from the server mapping whenever a fresh payload arrives OR the dialog opens
  // for a different provider — done during render (the "you might not need an effect" reset pattern)
  // rather than in an effect, so there's no cascading-render lint violation. The dialog stays mounted
  // across opens and React Query caches the mapping, so keying the reseed on `provider` (not just the
  // response identity) is what discards abandoned edits when the same provider is reopened after Cancel.
  const [seededFor, setSeededFor] = useState<{
    provider: IntegrationProvider | null;
    data?: GlMappingResponse;
  }>({
    provider: null,
  });
  if (open) {
    if (seededFor.provider !== provider || (query.data && query.data !== seededFor.data)) {
      setSeededFor({ provider, data: query.data });
      setDraft(
        query.data
          ? Object.fromEntries(
              query.data.mappings.map((entry) => [
                entry.categoryId,
                entry.glAccountId ?? NOT_MAPPED,
              ]),
            )
          : {},
      );
    }
  } else if (seededFor.provider !== null) {
    // Clear the seed marker on close so reopening the same provider reseeds from the server and
    // discards any edits the user abandoned with Cancel (the dialog stays mounted across opens).
    setSeededFor({ provider: null });
  }

  const options = useMemo(() => {
    const accounts = query.data?.chartOfAccounts ?? [];
    return [
      { value: NOT_MAPPED, label: 'Not mapped' },
      ...accounts.map((account) => ({
        value: account.id,
        label: account.name,
        meta: <span className="font-mono text-cl-text-3">{account.code}</span>,
      })),
    ];
  }, [query.data]);

  const unmappedCount = Object.values(draft).filter((value) => value === NOT_MAPPED).length;

  function save() {
    if (!provider) return;
    const mappings = Object.entries(draft).map(([categoryId, glAccountId]) => ({
      categoryId,
      glAccountId: glAccountId === NOT_MAPPED ? null : glAccountId,
    }));
    update.mutate(
      { provider, mappings },
      {
        onSuccess: () => {
          onSaved(`GL mapping saved for ${providerName}`);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} maxWidth={560}>
      <Modal.Title asChild>
        <Text as="h2" size="heading" weight="semibold" className="mb-1">
          {providerName} GL mapping
        </Text>
      </Modal.Title>

      <Text as="p" size="label" tone="muted" className="mt-1">
        Map each Clearline expense category to a {providerName} account. Unmapped categories are
        skipped during sync.
      </Text>

      <div className="border-cl-border mt-4 overflow-hidden rounded-lg border">
        {(query.data?.mappings ?? []).map((entry, index) => {
          const value = draft[entry.categoryId] ?? NOT_MAPPED;
          const isUnmapped = value === NOT_MAPPED;
          return (
            <div
              key={entry.categoryId}
              className={`border-cl-border grid grid-cols-[1fr_1.4fr] items-center gap-3 px-4 py-3 ${
                index > 0 ? 'border-t' : ''
              } ${isUnmapped ? 'bg-cl-warn-weak' : ''}`}
            >
              <div className="flex items-center gap-2">
                <Text as="div" size="label" weight="medium">
                  {entry.categoryLabel}
                </Text>
                {isUnmapped ? (
                  <span className="text-cl-warn inline-flex items-center gap-1 text-[11px] font-semibold">
                    <Icon name="triangle-alert" size={11} />
                    Not mapped
                  </span>
                ) : null}
              </div>
              <Select
                aria-label={`GL account for ${entry.categoryLabel}`}
                value={value}
                onValueChange={(next) =>
                  setDraft((prev) => ({ ...prev, [entry.categoryId]: next }))
                }
                options={options}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Text as="span" size="label" tone={unmappedCount > 0 ? 'warning' : 'muted'}>
          {unmappedCount > 0
            ? `${unmappedCount} categor${unmappedCount === 1 ? 'y' : 'ies'} not mapped`
            : 'All categories mapped'}
        </Text>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={update.isPending}>
            Save mapping
          </Button>
        </div>
      </div>
    </Modal>
  );
}

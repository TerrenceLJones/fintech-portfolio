import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AccessDenied, ConfirmationDialog, IntegrationCard, Text } from '@clearline/ui';
import {
  IntegrationsForbiddenError,
  useDisconnectIntegration,
  useIntegrations,
  useReconnectIntegration,
  useSyncNow,
} from '@clearline/data-access-integrations';
import { INTEGRATION_CATALOGUE } from '@clearline/domain-integrations';
import type { Integration, IntegrationProvider } from '@clearline/contracts';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { ToastViewport } from '../../components/ToastViewport';
import { useToast } from '../../hooks/useToast';
import { DEFAULT_SETTINGS_SLUG, settingsPathForSlug } from '../../rbac/settings-sections';
import { OAuthConsentDialog } from './integrations/OAuthConsentDialog';
import { GlMappingDialog } from './integrations/GlMappingDialog';
import { SyncLogDialog } from './integrations/SyncLogDialog';
import { integrationsBeacon } from './integrations.beacon';

function lastSyncLabel(integration: Integration): string | undefined {
  if (!integration.lastSyncAt) return undefined;
  return new Date(integration.lastSyncAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Settings → Integrations (US-CW-039). Connect QuickBooks/Xero/NetSuite via a mocked OAuth flow (AC-01),
 * configure GL mapping (AC-02), run and monitor syncs (AC-03/05), reconnect a failed connection (AC-04),
 * and disconnect behind a confirmation that names what stops and that mappings are preserved (AC-06).
 * Gated by `integrations:manage` — the data endpoint returns 403 independently and the page degrades to
 * AccessDenied (AC-09).
 */
export function IntegrationsPage() {
  useDemoBeacon(integrationsBeacon);
  const navigate = useNavigate();
  const query = useIntegrations();
  const syncNow = useSyncNow();
  const reconnect = useReconnectIntegration();
  const disconnect = useDisconnectIntegration();
  const { toast, show: showToast } = useToast(4000);

  const [connecting, setConnecting] = useState<IntegrationProvider | null>(null);
  const [mapping, setMapping] = useState<IntegrationProvider | null>(null);
  const [syncLog, setSyncLog] = useState<IntegrationProvider | null>(null);
  const [disconnecting, setDisconnecting] = useState<Integration | null>(null);

  if (query.error instanceof IntegrationsForbiddenError) {
    return (
      <AccessDenied
        message="Ask an admin if you need it. This settings section is available to a different role."
        requestLine="403 Forbidden · GET /api/integrations"
        actionLabel="Back to Personal Info"
        onAction={() => navigate(settingsPathForSlug(DEFAULT_SETTINGS_SLUG))}
      />
    );
  }

  const integrations = query.data?.integrations ?? [];

  function runSync(provider: IntegrationProvider, name: string) {
    syncNow.mutate(provider, {
      onSuccess: (result) => {
        if (result.outcome === 'failed') {
          showToast(`Sync failed — ${name} connection may need to be refreshed.`);
        } else if (result.outcome === 'partial') {
          // A partial run exported some rows but skipped unmapped categories — say so rather than
          // reporting a clean "complete", so the skipped work isn't hidden behind the sync log (AC-05).
          showToast(
            `Partial sync — ${result.recordsSynced} transactions exported to ${name}; unmapped categories were skipped.`,
          );
        } else {
          showToast(`Sync complete — ${result.recordsSynced} transactions exported to ${name}`);
        }
      },
    });
  }

  function confirmDisconnect() {
    if (!disconnecting) return;
    const provider = disconnecting.provider;
    const name = disconnecting.name;
    disconnect.mutate(provider, { onSuccess: () => showToast(`Disconnected ${name}`) });
    setDisconnecting(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Text as="h2" size="heading">
          Integrations
        </Text>
        <Text as="p" size="label" tone="muted" className="mt-1">
          Connect your accounting software to export approved spend to your general ledger.
        </Text>
      </div>

      {query.isPending ? (
        <Text as="p" tone="muted">
          Loading integrations…
        </Text>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.provider}
              integration={integration}
              initials={INTEGRATION_CATALOGUE[integration.provider].initials}
              lastSyncLabel={lastSyncLabel(integration)}
              syncing={syncNow.isPending && syncNow.variables === integration.provider}
              onConnect={() => setConnecting(integration.provider)}
              onSyncNow={() => runSync(integration.provider, integration.name)}
              onConfigureMapping={() => setMapping(integration.provider)}
              onViewSyncLog={() => setSyncLog(integration.provider)}
              onReconnect={() =>
                reconnect.mutate(integration.provider, {
                  onSuccess: () => showToast(`Reconnected ${integration.name}`),
                })
              }
              onDisconnect={() => setDisconnecting(integration)}
            />
          ))}
        </div>
      )}

      <OAuthConsentDialog
        provider={connecting}
        providerName={connecting ? INTEGRATION_CATALOGUE[connecting].name : ''}
        onOpenChange={(open) => {
          if (!open) setConnecting(null);
        }}
        onConnected={showToast}
      />

      <GlMappingDialog
        provider={mapping}
        providerName={mapping ? INTEGRATION_CATALOGUE[mapping].name : ''}
        onOpenChange={(open) => {
          if (!open) setMapping(null);
        }}
        onSaved={showToast}
      />

      <SyncLogDialog
        provider={syncLog}
        providerName={syncLog ? INTEGRATION_CATALOGUE[syncLog].name : ''}
        onOpenChange={(open) => {
          if (!open) setSyncLog(null);
        }}
      />

      <ConfirmationDialog
        open={disconnecting !== null}
        onOpenChange={(open) => {
          if (!open) setDisconnecting(null);
        }}
        title={disconnecting ? `Disconnect ${disconnecting.name}?` : 'Disconnect integration?'}
        body="Auto-sync stops immediately. Your existing GL code mappings are preserved and restored if you reconnect. Transactions already exported are not affected."
        confirmLabel="Disconnect"
        countdown={0}
        onConfirm={confirmDisconnect}
      />

      <ToastViewport toast={toast} />
    </div>
  );
}

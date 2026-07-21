import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AccessDenied, Button, ConfirmationDialog, EmptyState, Icon, Text } from '@clearline/ui';
import {
  ConnectedAccountsForbiddenError,
  useConnectedAccounts,
  useReconnectAccount,
  useRemoveAccount,
} from '@clearline/data-access-connected-accounts';
import type { ConnectedAccount } from '@clearline/contracts';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { ToastViewport } from '../../components/ToastViewport';
import { useToast } from '../../hooks/useToast';
import { DEFAULT_SETTINGS_SLUG, settingsPathForSlug } from '../../rbac/settings-sections';
import { AccountStatusBadge } from './connected-accounts/AccountStatusBadge';
import { ConnectAccountDialog } from './connected-accounts/ConnectAccountDialog';
import { MicroDepositVerifyDialog } from './connected-accounts/MicroDepositVerifyDialog';
import { connectedAccountsBeacon } from './connected-accounts.beacon';

const CARD = 'border-cl-border bg-cl-surface rounded-xl border p-5';

function methodLabel(account: ConnectedAccount): string {
  return account.method === 'plaid' ? 'Connected via Plaid' : 'Manually connected';
}

/**
 * Settings → Connected Accounts (US-CW-038). Connect funding accounts via the (mocked) Plaid Link or
 * manual micro-deposit verification, reconnect a Plaid account that needs re-auth (AC-08), and remove an
 * account behind a confirmation that names it and spells out the consequence (AC-07). Gated by
 * `bank-accounts:manage` — the data endpoint returns 403 independently, and the page degrades to
 * AccessDenied on that (AC-09).
 */
export function ConnectedAccountsPage() {
  useDemoBeacon(connectedAccountsBeacon);
  const navigate = useNavigate();
  const query = useConnectedAccounts();
  const reconnect = useReconnectAccount();
  const remove = useRemoveAccount();
  const { toast, show: showToast } = useToast(4000);

  const [connectOpen, setConnectOpen] = useState(false);
  const [verifying, setVerifying] = useState<ConnectedAccount | null>(null);
  const [removing, setRemoving] = useState<ConnectedAccount | null>(null);

  if (query.error instanceof ConnectedAccountsForbiddenError) {
    return (
      <AccessDenied
        message="Ask an admin if you need it. This settings section is available to a different role."
        requestLine="403 Forbidden · GET /api/connected-accounts"
        actionLabel="Back to Personal Info"
        onAction={() => navigate(settingsPathForSlug(DEFAULT_SETTINGS_SLUG))}
      />
    );
  }

  const accounts = query.data?.accounts ?? [];

  function confirmRemove() {
    if (!removing) return;
    const account = removing;
    remove.mutate(account.id, {
      onSuccess: () => showToast(`Removed ${account.institutionName} ••••${account.last4}`),
    });
    setRemoving(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Text as="h2" size="heading">
          Connected Accounts
        </Text>
        <Button icon="plus" onClick={() => setConnectOpen(true)}>
          Connect account
        </Button>
      </div>

      {query.isPending ? (
        <Text as="p" tone="muted">
          Loading accounts…
        </Text>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon="building"
          title="No connected accounts"
          body="Connect a bank account via Plaid or manually to fund ACH transfers."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {accounts.map((account) => (
            <div key={account.id} className={`${CARD} flex flex-wrap items-center gap-4`}>
              <div className="bg-cl-inset border-cl-border flex h-10 w-10 items-center justify-center rounded-lg border">
                <Icon name="building" size={18} />
              </div>
              <div className="min-w-40 flex-1">
                <Text as="div" size="label" weight="semibold">
                  {account.institutionName}
                </Text>
                <Text as="div" size="label" tone="faint" className="font-mono">
                  ••••{account.last4} · {methodLabel(account)}
                </Text>
              </div>
              <AccountStatusBadge status={account.status} />
              <div className="flex gap-2">
                {account.status === 'pending_verification' ? (
                  <Button variant="secondary" size="sm" onClick={() => setVerifying(account)}>
                    Verify
                  </Button>
                ) : null}
                {account.status === 'reconnect_required' ? (
                  <Button
                    size="sm"
                    loading={reconnect.isPending && reconnect.variables === account.id}
                    onClick={() =>
                      reconnect.mutate(account.id, {
                        onSuccess: () => showToast(`Reconnected ${account.institutionName}`),
                      })
                    }
                  >
                    Reconnect
                  </Button>
                ) : null}
                <Button variant="secondary" size="sm" onClick={() => setRemoving(account)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConnectAccountDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={showToast}
      />

      <MicroDepositVerifyDialog
        account={verifying}
        onOpenChange={(open) => {
          if (!open) setVerifying(null);
        }}
        onVerified={showToast}
      />

      <ConfirmationDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title={
          removing ? `Remove ${removing.institutionName} ••••${removing.last4}?` : 'Remove account?'
        }
        body="This account will no longer be available for ACH transfers. In-flight payments are not affected — only future transfers are blocked."
        confirmLabel="Remove account"
        countdown={0}
        onConfirm={confirmRemove}
      />

      <ToastViewport toast={toast} />
    </div>
  );
}

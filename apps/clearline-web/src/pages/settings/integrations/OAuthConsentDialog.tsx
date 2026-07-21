import { Alert, Button, Icon, Modal, Text } from '@clearline/ui';
import type { IntegrationProvider } from '@clearline/contracts';
import { IntegrationActionError, useConnectIntegration } from '@clearline/data-access-integrations';

export interface OAuthConsentDialogProps {
  /** The provider being connected, or null when the dialog is closed. */
  provider: IntegrationProvider | null;
  providerName: string;
  onOpenChange: (open: boolean) => void;
  onConnected: (message: string) => void;
}

/**
 * The mocked provider OAuth authorization step (US-CW-039 AC-01). Stands in for the redirect to the
 * provider's consent page — consistent with the mocked Plaid connect of US-CW-038 — modelling both
 * outcomes: Authorize returns to Clearline with the integration Connected, and Cancel/Deny returns
 * with the card still Disconnected and no partial connection (AC-01 edge case).
 */
export function OAuthConsentDialog({
  provider,
  providerName,
  onOpenChange,
  onConnected,
}: OAuthConsentDialogProps) {
  const connect = useConnectIntegration();

  function close(next: boolean) {
    if (!next) connect.reset();
    onOpenChange(next);
  }

  function authorize() {
    if (!provider) return;
    connect.mutate(provider, {
      onSuccess: () => {
        onConnected(`Connected ${providerName}`);
        close(false);
      },
    });
  }

  const alreadyConnected =
    connect.error instanceof IntegrationActionError && connect.error.code === 'already_connected';

  return (
    <Modal open={provider !== null} onOpenChange={close} maxWidth={420}>
      <Modal.Title asChild>
        <Text as="h2" size="heading" weight="semibold" className="mb-1">
          Authorize {providerName}
        </Text>
      </Modal.Title>

      <div className="mt-4 flex flex-col gap-4">
        <div className="border-cl-border bg-cl-inset flex items-start gap-3 rounded-lg border p-3.5">
          <Icon name="shield-check" size={18} className="text-cl-accent-text mt-0.5 shrink-0" />
          <Text as="p" size="label" tone="muted">
            You'll be redirected to {providerName} to sign in and authorize Clearline to read your
            chart of accounts and export expense transactions. You can disconnect at any time.
          </Text>
        </div>

        {alreadyConnected ? (
          <Alert
            tone="warning"
            title="Already connected"
            message={`${providerName} is already connected to this organization.`}
          />
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button onClick={authorize} loading={connect.isPending}>
            Authorize {providerName}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

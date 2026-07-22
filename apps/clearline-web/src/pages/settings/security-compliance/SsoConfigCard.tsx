import { useState } from 'react';
import { Alert, Button, ConfirmationDialog, Icon, Switch, TextField, Text } from '@clearline/ui';
import type { OrgSecurityResponse } from '@clearline/contracts';
import { canEnableSso, validateSsoConfig } from '@clearline/domain-org-security';
import { useSetSsoEnabled, useTestSso } from '@clearline/data-access-org-security';
import { CARD } from './card';

/**
 * SSO / SAML single sign-on (US-CW-040 AC-01/02). The Enable toggle is inert until a connection test
 * passes — the test gates the cutover. Enabling warns that password login is disabled for all but
 * emergency admin accounts. The uploaded certificate is sent only to run the handshake; the server
 * stores just a fingerprint (AC-10), which is all that's ever shown back. Status carries icon + text.
 */
export function SsoConfigCard({
  posture,
  onToast,
}: {
  posture: OrgSecurityResponse;
  onToast: (message: string) => void;
}) {
  const testSso = useTestSso();
  const setEnabled = useSetSsoEnabled();
  const { sso } = posture;

  const [metadataUrl, setMetadataUrl] = useState(sso.metadataUrl ?? '');
  const [entityId, setEntityId] = useState(sso.entityId ?? '');
  const [certificate, setCertificate] = useState('');
  const [enableOpen, setEnableOpen] = useState(false);

  const canTest =
    validateSsoConfig({ metadataUrl, entityId, certificate }).ok && !testSso.isPending;
  const passed = canEnableSso(sso);

  function handleTest() {
    testSso.mutate(
      { metadataUrl, entityId, certificate },
      {
        onSuccess: (result) => {
          // Clear the in-memory certificate once submitted — it never needs to live in the client again.
          setCertificate('');
          onToast(
            result.result === 'passed'
              ? 'Connection successful'
              : `Connection failed — ${result.reason}`,
          );
        },
      },
    );
  }

  function handleToggle(next: boolean) {
    if (next) {
      setEnableOpen(true); // confirm before the cutover (AC-02)
    } else {
      setEnabled.mutate(false, { onSuccess: () => onToast('SSO disabled') });
    }
  }

  function confirmEnable() {
    setEnableOpen(false);
    setEnabled.mutate(true, { onSuccess: () => onToast('SSO enabled') });
  }

  return (
    <section className={`${CARD} flex flex-col gap-4`} aria-labelledby="sso-heading">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Text as="h3" id="sso-heading" size="label" weight="semibold">
            Single sign-on (SAML)
          </Text>
          <Text as="p" tone="muted" size="label">
            Route members through your identity provider. Test the connection before enabling it.
          </Text>
        </div>
        {sso.enabled ? (
          <span className="text-cl-pos bg-cl-pos-weak inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
            <Icon name="check" size={12} /> Enabled
          </span>
        ) : (
          <span className="text-cl-text-2 bg-cl-inset inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
            <Icon name="minus" size={12} /> Disabled
          </span>
        )}
      </div>

      <TextField
        label="SAML metadata URL"
        value={metadataUrl}
        placeholder="https://idp.example.com/app/saml/metadata"
        onChange={(event) => setMetadataUrl(event.target.value)}
      />
      <TextField
        label="Entity ID"
        value={entityId}
        placeholder="urn:your-org"
        onChange={(event) => setEntityId(event.target.value)}
      />
      <label className="flex flex-col gap-1.5">
        <Text as="span" size="label" weight="medium">
          IdP certificate (PEM)
          {sso.certificateFingerprint ? (
            <Text as="span" tone="muted" size="label" className="ml-2 font-normal">
              on file · fingerprint {sso.certificateFingerprint}
            </Text>
          ) : null}
        </Text>
        <textarea
          value={certificate}
          onChange={(event) => setCertificate(event.target.value)}
          rows={4}
          placeholder="-----BEGIN CERTIFICATE-----"
          className="border-cl-border bg-cl-surface focus:border-cl-accent rounded-lg border px-3 py-2 font-mono text-xs outline-none"
        />
      </label>

      {sso.lastTest ? (
        <Alert
          tone={sso.lastTest.result === 'passed' ? 'positive' : 'negative'}
          title={
            sso.lastTest.result === 'passed'
              ? 'Connection successful'
              : (sso.lastTest.reason ?? 'Connection failed')
          }
        />
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <Button
          variant="secondary"
          onClick={handleTest}
          loading={testSso.isPending}
          disabled={!canTest}
        >
          Test connection
        </Button>
        <div className="flex items-center gap-2">
          <Text as="span" size="label" weight="medium" tone={passed ? 'default' : 'muted'}>
            Enabled
          </Text>
          <Switch
            checked={sso.enabled}
            onCheckedChange={handleToggle}
            disabled={!passed && !sso.enabled}
            aria-label="Enable SSO"
          />
        </div>
      </div>
      {!passed && !sso.enabled ? (
        <Text as="p" tone="muted" size="label" role="note">
          Run a passing connection test to enable SSO.
        </Text>
      ) : null}

      <ConfirmationDialog
        open={enableOpen}
        onOpenChange={setEnableOpen}
        title="Enable single sign-on?"
        body="Enabling SSO will redirect all members to your identity provider for login. Password-based login will be disabled for all members except emergency admin accounts."
        confirmLabel="Enable SSO"
        countdown={0}
        onConfirm={confirmEnable}
      />
    </section>
  );
}

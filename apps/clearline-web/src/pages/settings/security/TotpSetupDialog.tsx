import { useState } from 'react';
import { Button, Icon, Modal, OtpInput, Text } from '@clearline/ui';
import { QrCode } from './QrCode';
import type { TotpSetupController } from './use-totp-setup';

interface TotpSetupDialogProps {
  controller: TotpSetupController;
  /** Fired when the user finishes the flow on the completion step (2FA is now enabled). */
  onDone: () => void;
}

/** Group the base32 secret into 4-char blocks for readable manual entry (design §19.2). */
function formatSecret(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(' ') ?? secret;
}

/**
 * The design §19.2 TOTPSetupFlow rendered as a stepped modal: generate (client-side QR + manual entry)
 * → verify (6-digit code) → complete (backup codes, shown once). Driven entirely by the
 * `useTotpSetup` controller; the modal is open whenever the controller has a non-null step.
 */
export function TotpSetupDialog({ controller, onDone }: TotpSetupDialogProps) {
  const {
    step,
    secret,
    otpauthUri,
    isStarting,
    isVerifying,
    code,
    setCode,
    verify,
    verifyError,
    backupCodes,
  } = controller;
  const [showManual, setShowManual] = useState(false);
  const [copied, setCopied] = useState<'secret' | 'codes' | null>(null);

  const open = step !== null;

  function copy(text: string, which: 'secret' | 'codes') {
    void navigator.clipboard?.writeText(text);
    setCopied(which);
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) controller.close();
      }}
      maxWidth={460}
    >
      {step === 'generate' && (
        <div className="flex flex-col items-center gap-4 text-center">
          <Modal.Title asChild>
            <Text as="h2" size="heading">
              Scan the QR code
            </Text>
          </Modal.Title>
          <Modal.Description asChild>
            <Text as="p" tone="muted" size="label">
              Scan this with your authenticator app (1Password, Google Authenticator, Authy).
            </Text>
          </Modal.Description>

          {isStarting || !otpauthUri ? (
            <div className="bg-cl-inset h-40 w-40 animate-pulse rounded-lg" aria-hidden />
          ) : (
            <QrCode value={otpauthUri} />
          )}
          <Text as="p" tone="faint" size="mono">
            Rendered in your browser — the secret never leaves this device.
          </Text>

          <button
            type="button"
            className="text-cl-accent-text text-sm"
            onClick={() => setShowManual((prev) => !prev)}
          >
            I can't scan a QR code {showManual ? '▴' : '▾'}
          </button>
          {showManual && secret ? (
            <div className="bg-cl-inset flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2">
              <Text as="span" size="mono" data-testid="totp-manual-secret">
                {formatSecret(secret)}
              </Text>
              <Button variant="ghost" size="sm" onClick={() => copy(secret, 'secret')}>
                <Icon name="copy" size={14} /> {copied === 'secret' ? 'Copied' : 'Copy'}
              </Button>
            </div>
          ) : null}

          <Button variant="primary" onClick={controller.toVerify} disabled={!otpauthUri}>
            Continue
          </Button>
        </div>
      )}

      {step === 'verify' && (
        <div className="flex flex-col items-center gap-4 text-center">
          <Modal.Title asChild>
            <Text as="h2" size="heading">
              Enter the 6-digit code
            </Text>
          </Modal.Title>
          <Modal.Description asChild>
            <Text as="p" tone="muted" size="label">
              Open your authenticator app and enter the current code.
            </Text>
          </Modal.Description>

          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={verify}
            state={verifyError ? 'error' : 'default'}
            autoFocus
          />
          {verifyError ? (
            <Text as="p" tone="negative" size="label" role="alert">
              {verifyError}
            </Text>
          ) : null}

          <Button
            variant="primary"
            onClick={() => verify()}
            loading={isVerifying}
            disabled={code.length !== 6}
          >
            Verify
          </Button>
        </div>
      )}

      {step === 'complete' && (
        <div className="flex flex-col gap-4">
          <Modal.Title asChild>
            <Text as="h2" size="heading">
              Save your backup codes
            </Text>
          </Modal.Title>

          <div className="bg-cl-warn-weak text-cl-warn flex items-start gap-2 rounded-lg px-3 py-2">
            <Icon name="triangle-alert" size={16} />
            <Text as="p" size="label" weight="semibold" className="text-cl-warn">
              Store these somewhere safe — they won't be shown again.
            </Text>
          </div>

          <ul
            className="grid grid-cols-2 gap-2"
            aria-label="Backup codes"
            data-testid="backup-codes"
          >
            {backupCodes.map((backupCode) => (
              <li
                key={backupCode}
                className="bg-cl-inset rounded-md px-3 py-1.5 text-center font-mono text-sm"
              >
                {backupCode}
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => copy(backupCodes.join('\n'), 'codes')}
            >
              <Icon name="copy" size={14} /> {copied === 'codes' ? 'Copied' : 'Copy all'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Icon name="file-text" size={14} /> Print
            </Button>
          </div>

          <Button
            variant="primary"
            onClick={() => {
              controller.close();
              onDone();
            }}
          >
            Done
          </Button>
        </div>
      )}
    </Modal>
  );
}

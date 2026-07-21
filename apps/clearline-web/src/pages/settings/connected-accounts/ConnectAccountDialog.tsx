import { useState } from 'react';
import { Alert, Button, Modal, Text, TextField } from '@clearline/ui';
import {
  ConnectedAccountActionError,
  useConnectManually,
  useConnectViaPlaid,
} from '@clearline/data-access-connected-accounts';

export interface ConnectAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: (message: string) => void;
}

const MANUAL_ERROR_COPY: Record<string, string> = {
  invalid_routing: 'Routing number must be 9 digits.',
  invalid_account: 'Enter a valid account number.',
  already_connected: 'That account is already connected.',
};

/**
 * Connect a bank account (US-CW-038 AC-04/05). A first screen offers the two trusted paths — the
 * (mocked) Plaid Link, which lands the account verified, and manual entry, which starts the
 * micro-deposit challenge. The manual form validates a 9-digit routing number inline before submit.
 */
export function ConnectAccountDialog({
  open,
  onOpenChange,
  onConnected,
}: ConnectAccountDialogProps) {
  const [mode, setMode] = useState<'choose' | 'manual'>('choose');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const plaid = useConnectViaPlaid();
  const manual = useConnectManually();

  function reset() {
    setMode('choose');
    setRoutingNumber('');
    setAccountNumber('');
    plaid.reset();
    manual.reset();
  }

  function close(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function connectPlaid() {
    plaid.mutate(undefined, {
      onSuccess: () => {
        onConnected('Account connected via Plaid');
        close(false);
      },
    });
  }

  function submitManual() {
    manual.mutate(
      { routingNumber, accountNumber },
      {
        onSuccess: () => {
          onConnected('Micro-deposits sent — verify in 1–2 business days');
          close(false);
        },
      },
    );
  }

  const manualError =
    manual.error instanceof ConnectedAccountActionError
      ? (MANUAL_ERROR_COPY[manual.error.code] ?? 'Couldn’t connect that account. Try again.')
      : null;

  return (
    <Modal open={open} onOpenChange={close} maxWidth={420}>
      <Modal.Title asChild>
        <Text as="h2" size="heading" weight="semibold" className="mb-1">
          Connect a bank account
        </Text>
      </Modal.Title>

      {mode === 'choose' ? (
        <div className="mt-4 flex flex-col gap-3">
          <Button fullWidth onClick={connectPlaid} loading={plaid.isPending}>
            Connect via Plaid
          </Button>
          <Button fullWidth variant="secondary" onClick={() => setMode('manual')}>
            Enter account details manually
          </Button>
          <Text as="p" size="label" tone="faint" className="mt-1">
            Plaid connects instantly. Manual entry sends two micro-deposits you confirm in 1–2
            business days.
          </Text>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <TextField
            label="Routing number"
            value={routingNumber}
            onChange={(event) => setRoutingNumber(event.target.value)}
            inputMode="numeric"
            placeholder="9 digits"
          />
          <TextField
            label="Account number"
            value={accountNumber}
            onChange={(event) => setAccountNumber(event.target.value)}
            inputMode="numeric"
          />
          {manualError ? (
            <Alert tone="negative" title="Couldn’t connect" message={manualError} />
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMode('choose')}>
              Back
            </Button>
            <Button
              onClick={submitManual}
              loading={manual.isPending}
              disabled={routingNumber.trim() === '' || accountNumber.trim() === ''}
            >
              Send micro-deposits
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

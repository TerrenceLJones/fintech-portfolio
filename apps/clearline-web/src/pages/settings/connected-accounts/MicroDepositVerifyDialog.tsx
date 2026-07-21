import { useState } from 'react';
import { Alert, Button, Modal, Text, TextField } from '@clearline/ui';
import type { ConnectedAccount } from '@clearline/contracts';
import { toMinorUnits } from '@clearline/money';
import { useVerifyMicroDeposits } from '@clearline/data-access-connected-accounts';

export interface MicroDepositVerifyDialogProps {
  account: ConnectedAccount | null;
  onOpenChange: (open: boolean) => void;
  onVerified: (message: string) => void;
}

/**
 * Enter the two micro-deposit amounts to verify a pending manual account (US-CW-038 AC-05/06). A
 * mismatch shows the exact retry copy and the remaining attempts; after three misses the account locks
 * and must be removed and reconnected. On success the dialog closes and the row flips to Connected.
 */
export function MicroDepositVerifyDialog({
  account,
  onOpenChange,
  onVerified,
}: MicroDepositVerifyDialogProps) {
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const verify = useVerifyMicroDeposits();

  function close(next: boolean) {
    if (!next) {
      setFirst('');
      setSecond('');
      verify.reset();
    }
    onOpenChange(next);
  }

  function submit() {
    if (!account) return;
    verify.mutate(
      {
        id: account.id,
        amountsMinorUnits: [
          toMinorUnits(Number(first || '0'), 'USD'),
          toMinorUnits(Number(second || '0'), 'USD'),
        ],
      },
      {
        onSuccess: (result) => {
          if (result.outcome === 'verified') {
            onVerified('Account verified');
            close(false);
          } else if (result.outcome === 'locked') {
            onVerified('Verification locked — remove and reconnect to try again');
            close(false);
          } else {
            setFirst('');
            setSecond('');
          }
        },
      },
    );
  }

  const mismatch = verify.data?.outcome === 'mismatch' ? verify.data : null;

  return (
    <Modal open={account !== null} onOpenChange={close} maxWidth={420}>
      <Modal.Title asChild>
        <Text as="h2" size="heading" weight="semibold" className="mb-1">
          Verify micro-deposits
        </Text>
      </Modal.Title>
      {account ? (
        <Text as="p" size="label" tone="muted" className="mb-4">
          Enter the two amounts deposited to {account.institutionName} ••••{account.last4}.
        </Text>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="flex gap-4">
          <div className="w-40">
            <TextField
              label="First amount"
              value={first}
              onChange={(event) => setFirst(event.target.value)}
              inputMode="decimal"
              prefix="$"
              placeholder="0.00"
            />
          </div>
          <div className="w-40">
            <TextField
              label="Second amount"
              value={second}
              onChange={(event) => setSecond(event.target.value)}
              inputMode="decimal"
              prefix="$"
              placeholder="0.00"
            />
          </div>
        </div>

        {mismatch ? (
          <Alert
            tone="negative"
            title="Those amounts don’t match"
            message={`Check your bank statement and try again. ${mismatch.attemptsRemaining} attempt${
              mismatch.attemptsRemaining === 1 ? '' : 's'
            } left.`}
          />
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={verify.isPending}
            disabled={first.trim() === '' || second.trim() === ''}
          >
            Verify account
          </Button>
        </div>
      </div>
    </Modal>
  );
}

import { Avatar, Button, Icon, Text, TextField } from '@clearline/ui';
import { PAYMENT_ERROR_ID } from './PaymentFormAlerts';
import { initialsFor } from './format';
import type { NewPaymentForm } from './use-new-payment-form';

interface RecipientPickerProps {
  recipients: NewPaymentForm['recipients'];
  recipientId: NewPaymentForm['recipientId'];
  manualMode: NewPaymentForm['manualMode'];
  routingNumber: NewPaymentForm['routingNumber'];
  accountNumber: NewPaymentForm['accountNumber'];
  activeError: NewPaymentForm['activeError'];
  onSelect: NewPaymentForm['selectRecipient'];
  onEnterManualMode: NewPaymentForm['enterManualMode'];
  onRoutingNumberChange: NewPaymentForm['setRoutingNumber'];
  onAccountNumberChange: NewPaymentForm['setAccountNumber'];
}

/** Recipient list with a manual account-entry fallback for recipients not yet on file. */
export function RecipientPicker({
  recipients,
  recipientId,
  manualMode,
  routingNumber,
  accountNumber,
  activeError,
  onSelect,
  onEnterManualMode,
  onRoutingNumberChange,
  onAccountNumberChange,
}: RecipientPickerProps) {
  const recipientError = activeError?.field === 'recipient' ? 'error' : undefined;
  return (
    <div className="mb-4">
      <Text as="div" size="label" tone="muted" className="mb-2">
        Recipient
      </Text>
      <ul className="flex flex-col gap-2">
        {recipients.map((recipient) => {
          const selected = !manualMode && recipient.id === recipientId;
          const closed = recipient.status === 'closed';
          return (
            <li key={recipient.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(recipient)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left ${
                  selected
                    ? 'border-cl-accent bg-cl-accent-weak'
                    : 'border-cl-border-2 bg-cl-surface'
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar
                    initials={initialsFor(recipient.name)}
                    size={30}
                    tone={selected ? 'accent' : 'neutral'}
                  />
                  <span className="flex min-w-0 flex-col">
                    <Text as="span" size="body" weight="semibold" className="truncate">
                      {recipient.name}
                    </Text>
                    <Text as="span" size="mono" tone="faint">
                      {recipient.method.toUpperCase()} · {recipient.maskedAccount}
                    </Text>
                  </span>
                </span>
                {closed ? (
                  <Text
                    as="span"
                    size="label"
                    weight="semibold"
                    className="text-cl-neg flex-shrink-0"
                  >
                    Closed
                  </Text>
                ) : (
                  <span className="text-cl-pos flex flex-shrink-0 items-center gap-1 text-[11px] font-semibold">
                    <Icon name="check" size={12} />
                    Verified
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <Button variant="link" onClick={onEnterManualMode} className="mt-2">
        Recipient not listed? Enter account details
      </Button>
      {manualMode ? (
        <div className="mt-3 flex flex-col gap-3">
          <TextField
            label="Routing number"
            value={routingNumber}
            onChange={(e) => onRoutingNumberChange(e.target.value)}
            state={recipientError}
            aria-describedby={recipientError ? PAYMENT_ERROR_ID : undefined}
          />
          <TextField
            label="Account number"
            value={accountNumber}
            onChange={(e) => onAccountNumberChange(e.target.value)}
            state={recipientError}
            aria-describedby={recipientError ? PAYMENT_ERROR_ID : undefined}
          />
        </div>
      ) : null}
    </div>
  );
}

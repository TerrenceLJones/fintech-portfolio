import { useState } from 'react';
import { Alert, Button, Modal, Text, TextField } from '@clearline/ui';
import { useCancelSubscription } from '@clearline/data-access-billing';
import { CARD } from '../security-compliance/card';

/**
 * The deliberate, multi-step subscription cancellation (US-CW-042 AC-05/AC-06) — a stronger variant of
 * the §19.9 named-destruction doctrine. Step 1 spells out exactly what is lost; Step 2 requires typing
 * the company name EXACTLY, and the final button stays disabled until it matches. Cancellation is
 * scheduled for period-end, not immediate, and the org keeps read-only access during the grace window.
 */
export function CancelSubscriptionSection({
  companyName,
  onToast,
}: {
  companyName: string;
  onToast: (message: string) => void;
}) {
  const cancel = useCancelSubscription();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState('');

  const nameMatches = typed.trim() === companyName;

  function close() {
    setOpen(false);
    setStep(1);
    setTyped('');
    cancel.reset();
  }

  function handleConfirm() {
    cancel.mutate(companyName, {
      onSuccess: (result) => {
        onToast(`Subscription cancelled. You have access until ${result.accessUntil}.`);
        close();
      },
    });
  }

  return (
    <section className={`${CARD} flex flex-col gap-4`} aria-labelledby="cancel-heading">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Text as="h3" id="cancel-heading" size="label" weight="semibold">
            Cancel subscription
          </Text>
          <Text as="p" tone="muted" size="label" className="mt-1">
            Cancels at the end of your current billing period. You keep read-only access until then.
          </Text>
        </div>
        <Button variant="danger" onClick={() => setOpen(true)}>
          Cancel subscription
        </Button>
      </div>

      <Modal open={open} onOpenChange={(next) => (next ? setOpen(true) : close())} maxWidth={460}>
        <Modal.Title asChild>
          <Text as="h2" size="heading">
            Cancel subscription
          </Text>
        </Modal.Title>

        {step === 1 ? (
          <>
            <Modal.Description asChild>
              <Text as="p" tone="muted" size="label" className="mt-1">
                Cancelling schedules the end of your Clearline subscription. Here&rsquo;s what
                happens:
              </Text>
            </Modal.Description>
            <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5">
              <li>
                <Text as="span" size="label">
                  All card programs are deactivated.
                </Text>
              </li>
              <li>
                <Text as="span" size="label">
                  API keys are revoked.
                </Text>
              </li>
              <li>
                <Text as="span" size="label">
                  Your data stays available to export for 30 days.
                </Text>
              </li>
            </ul>
            <div className="mt-5 flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={close}>
                Keep subscription
              </Button>
              <Button variant="danger" onClick={() => setStep(2)}>
                Continue
              </Button>
            </div>
          </>
        ) : (
          <>
            <Modal.Description asChild>
              <Text as="p" tone="muted" size="label" className="mt-1">
                Type your company name <strong>{companyName}</strong> exactly to confirm.
              </Text>
            </Modal.Description>
            <div className="mt-4 flex flex-col gap-3">
              <TextField
                label="Company name"
                aria-label="Company name"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                state={cancel.isError ? 'error' : 'default'}
                error={cancel.isError ? 'Could not cancel. Please try again.' : undefined}
              />
              {nameMatches ? null : (
                <Alert
                  tone="warning"
                  title="This can’t be undone by you"
                  message="Cancellation is scheduled for the end of your billing period. A final confirmation is emailed to all admins."
                />
              )}
              <div className="flex items-center justify-end gap-3">
                <Button variant="ghost" onClick={close} disabled={cancel.isPending}>
                  Keep subscription
                </Button>
                <Button
                  variant="danger"
                  onClick={handleConfirm}
                  loading={cancel.isPending}
                  disabled={!nameMatches}
                >
                  Cancel subscription
                </Button>
              </div>
            </div>
          </>
        )}
      </Modal>
    </section>
  );
}

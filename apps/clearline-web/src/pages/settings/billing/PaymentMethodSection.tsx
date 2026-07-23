import { useState } from 'react';
import { Button, Modal, Text, TextField } from '@clearline/ui';
import type { PaymentMethodSummary } from '@clearline/contracts';
import { BillingActionError, useUpdatePaymentMethod } from '@clearline/data-access-billing';
import { CARD } from '../security-compliance/card';

function brandLabel(brand: string): string {
  if (brand === 'amex') return 'Amex';
  if (brand === 'mastercard') return 'Mastercard';
  if (brand === 'visa') return 'Visa';
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

/**
 * Payment method on file + the update flow (US-CW-042 AC-02/AC-03). The update opens a Stripe
 * Elements-style hosted form — modelled here by a mock token field so the demo never handles raw card
 * data (PCI scope reduction). A declined card surfaces "Your card was declined." and leaves the existing
 * method unchanged; a success swaps in the new card's masked PAN + brand.
 */
export function PaymentMethodSection({
  paymentMethod,
  onToast,
}: {
  paymentMethod: PaymentMethodSummary | null;
  onToast: (message: string) => void;
}) {
  const update = useUpdatePaymentMethod();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');

  const declined =
    update.error instanceof BillingActionError && update.error.code === 'card_declined';
  const otherError = update.isError && !declined;

  function close() {
    setOpen(false);
    setToken('');
    update.reset();
  }

  function handleSubmit() {
    update.mutate(token, {
      onSuccess: (result) => {
        onToast(
          `Payment method updated to ${brandLabel(result.paymentMethod.brand)} ···· ${result.paymentMethod.last4}`,
        );
        close();
      },
    });
  }

  return (
    <section className={`${CARD} flex flex-col gap-4`} aria-labelledby="payment-heading">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Text as="h3" id="payment-heading" size="label" weight="semibold">
            Payment method
          </Text>
          {paymentMethod ? (
            <Text as="p" tone="muted" size="label" className="mt-1">
              {brandLabel(paymentMethod.brand)} ending {paymentMethod.last4} · expires{' '}
              {String(paymentMethod.expMonth).padStart(2, '0')}/{paymentMethod.expYear}
            </Text>
          ) : (
            <Text as="p" tone="muted" size="label" className="mt-1">
              No card on file.
            </Text>
          )}
        </div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Update payment method
        </Button>
      </div>

      <Modal open={open} onOpenChange={(next) => (next ? setOpen(true) : close())} maxWidth={420}>
        <Modal.Title asChild>
          <Text as="h2" size="heading">
            Update payment method
          </Text>
        </Modal.Title>
        <Modal.Description asChild>
          <Text as="p" tone="muted" size="label" className="mt-1">
            Card details are entered in Stripe&rsquo;s secure hosted fields — they never touch
            Clearline&rsquo;s servers.
          </Text>
        </Modal.Description>

        <div className="mt-4 flex flex-col gap-3">
          {/* Stand-in for the Stripe Elements iframe — a mock token the demo tokenizes. */}
          <TextField
            label="Card (Stripe test token)"
            placeholder="tok_visa_4242 or tok_declined"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            state={declined || otherError ? 'error' : 'default'}
            error={
              declined
                ? 'Your card was declined.'
                : otherError
                  ? 'Something went wrong. Please try again.'
                  : undefined
            }
          />
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={close} disabled={update.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={update.isPending}
              disabled={!token.trim()}
            >
              Save card
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

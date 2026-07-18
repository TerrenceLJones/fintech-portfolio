import { Alert, Button } from '@clearline/ui';
import type { NewPaymentForm } from './use-new-payment-form';

/**
 * Stable id of the form-level validation live region. The erroring field points its
 * `aria-describedby` here so a screen reader on that field hears the announced reason
 * (US-CW-020 AC-04) rather than only seeing the red border.
 */
export const PAYMENT_ERROR_ID = 'new-payment-error';

interface PaymentFormAlertsProps {
  isTimeout: NewPaymentForm['isTimeout'];
  isExhausted: NewPaymentForm['isExhausted'];
  activeError: NewPaymentForm['activeError'];
  onRetry: NewPaymentForm['submit'];
}

/** Status/error banners that live with the fields they explain. */
export function PaymentFormAlerts({
  isTimeout,
  isExhausted,
  activeError,
  onRetry,
}: PaymentFormAlertsProps) {
  if (isTimeout) {
    return (
      <div className="mt-4">
        <Alert
          tone="info"
          title="We're still confirming your payment. We'll update this in a moment — don't resubmit."
        />
      </div>
    );
  }
  if (isExhausted) {
    return (
      <div className="mt-4">
        <Alert
          tone="negative"
          title="Couldn't process this payment. Try again."
          action="Retry"
          onAction={onRetry}
        />
      </div>
    );
  }
  if (activeError?.message) {
    return (
      <div className="mt-4">
        <div id={PAYMENT_ERROR_ID} role="alert" className="text-cl-neg text-[12px] font-medium">
          {activeError.message}
        </div>
        {activeError.limitCta ? (
          <Button variant="link" size="sm" className="mt-1 px-0">
            Request limit increase
          </Button>
        ) : null}
      </div>
    );
  }
  return null;
}

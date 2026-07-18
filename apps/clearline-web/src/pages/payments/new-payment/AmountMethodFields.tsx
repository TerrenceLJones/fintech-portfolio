import { currencySymbol } from '@clearline/money';
import { Select, Text, TextField } from '@clearline/ui';
import { paymentMethodOptions } from './payment-methods';
import { PAYMENT_ERROR_ID } from './PaymentFormAlerts';
import type { NewPaymentForm } from './use-new-payment-form';

interface AmountMethodFieldsProps {
  amountInput: NewPaymentForm['amountInput'];
  method: NewPaymentForm['method'];
  /** Source account currency — drives the currency-aware method fees. */
  sourceCurrency: string;
  activeError: NewPaymentForm['activeError'];
  onAmountChange: NewPaymentForm['changeAmount'];
  onMethodChange: NewPaymentForm['setMethod'];
}

/** Amount + method row. Amount is the prominent, tabular figure per the design. */
export function AmountMethodFields({
  amountInput,
  method,
  sourceCurrency,
  activeError,
  onAmountChange,
  onMethodChange,
}: AmountMethodFieldsProps) {
  return (
    <div className="mb-4 flex items-end gap-3.5">
      <div className="flex-[1.2]">
        <TextField
          label="Amount"
          inputMode="decimal"
          prefix={currencySymbol(sourceCurrency)}
          value={amountInput}
          onChange={(e) => onAmountChange(e.target.value)}
          state={activeError?.field === 'amount' ? 'error' : undefined}
          aria-describedby={activeError?.field === 'amount' ? PAYMENT_ERROR_ID : undefined}
          className="font-mono text-[18px] font-semibold tabular-nums"
        />
      </div>
      <div className="flex-1">
        <Text as="div" size="label" tone="muted" className="mb-1.5">
          Method
        </Text>
        <Select
          aria-label="Method"
          value={method}
          onValueChange={(value) => onMethodChange(value as NewPaymentForm['method'])}
          options={paymentMethodOptions(sourceCurrency)}
        />
      </div>
    </div>
  );
}

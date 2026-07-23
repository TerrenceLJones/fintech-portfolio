import { useState } from 'react';
import { Button, Icon, Text } from '@clearline/ui';
import { formatMoneyValue } from '@clearline/ui';
import type { InvoiceSummary } from '@clearline/contracts';
import { downloadInvoice } from '@clearline/data-access-billing';
import { CARD } from '../security-compliance/card';

/**
 * Past-invoice history (US-CW-042 AC-04). Each row downloads a period-named PDF immediately; the
 * filename comes from the server so re-downloading the same invoice reuses the period name rather than
 * appending "(1)".
 */
export function InvoiceHistorySection({
  invoices,
  onToast,
}: {
  invoices: InvoiceSummary[];
  onToast: (message: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleDownload(invoice: InvoiceSummary) {
    setBusyId(invoice.id);
    try {
      await downloadInvoice(invoice.id);
    } catch {
      onToast('Could not download that invoice. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={`${CARD} flex flex-col gap-4`} aria-labelledby="invoices-heading">
      <Text as="h3" id="invoices-heading" size="label" weight="semibold">
        Invoice history
      </Text>
      {invoices.length === 0 ? (
        <Text as="p" tone="muted" size="label">
          No invoices yet.
        </Text>
      ) : (
        <ul className="flex flex-col divide-y divide-cl-border">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="flex items-center justify-between gap-4 py-2.5">
              <div className="flex flex-col">
                <Text as="span" size="label" weight="semibold">
                  {invoice.period}
                </Text>
                <Text as="span" size="label" tone="muted">
                  Issued {invoice.issuedAt} · {formatMoneyValue(invoice.amount)}
                </Text>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDownload(invoice)}
                loading={busyId === invoice.id}
              >
                <Icon name="download" size={14} />
                Download
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, type DataTableRow } from './DataTable';
import { buildDataTableRow } from '../../test-factories';

const ROWS: DataTableRow[] = [
  buildDataTableRow(),
  buildDataTableRow({
    id: '2',
    vendor: 'Acme Corp',
    date: 'Jun 27, 2026',
    amount: 200,
    status: 'paid',
    account: '••2222',
  }),
];

describe('DataTable', () => {
  it('renders every row', () => {
    render(<DataTable rows={ROWS} />);
    expect(screen.getByText('Zephyr Co.')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('selects an individual row and shows the selection bar with the count', async () => {
    const user = userEvent.setup();
    render(<DataTable rows={ROWS} />);

    const rowCheckbox = screen.getByRole('checkbox', { name: 'Select Zephyr Co.' });
    await user.click(rowCheckbox);

    expect(screen.getByText('1 row selected')).toBeInTheDocument();
  });

  it('selects and deselects all rows via the header checkbox', async () => {
    const user = userEvent.setup();
    render(<DataTable rows={ROWS} />);

    await user.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(screen.getByText('2 rows selected')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(screen.queryByText(/rows? selected/)).not.toBeInTheDocument();
  });

  it('calls onApproveSelected with the selected row ids', async () => {
    const onApproveSelected = vi.fn();
    const user = userEvent.setup();
    render(<DataTable rows={ROWS} onApproveSelected={onApproveSelected} />);

    await user.click(screen.getByRole('checkbox', { name: 'Select Acme Corp' }));
    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(onApproveSelected).toHaveBeenCalledWith(['2']);
  });

  it('sorts by vendor when the column header is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<DataTable rows={ROWS} />);

    const vendorNames = () =>
      [...container.querySelectorAll('[style*="grid-template-columns"]')]
        .slice(1) // skip the header row
        .map((row) => within(row as HTMLElement).queryByText(/Co\.|Corp/)?.textContent);

    expect(vendorNames()[0]).toBe('Acme Corp'); // default ascending

    await user.click(screen.getByRole('button', { name: /Vendor/ }));
    expect(vendorNames()[0]).toBe('Zephyr Co.');
  });

  it('switches density on toggle', async () => {
    const user = userEvent.setup();
    render(<DataTable rows={ROWS} />);

    await user.click(screen.getByRole('button', { name: 'compact' }));
    // Density toggle re-renders without throwing; row content stays intact.
    expect(screen.getByText('Zephyr Co.')).toBeInTheDocument();
  });
});

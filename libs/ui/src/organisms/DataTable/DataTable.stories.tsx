import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DataTable } from './DataTable';
import { alertingAction } from '../../storybook-actions';

const meta: Meta<typeof DataTable> = {
  title: 'Organisms/DataTable',
  component: DataTable,
};
export default meta;

type Story = StoryObj<typeof DataTable>;

function rowCountMessage(action: string) {
  return (ids: string[]) => `${action} ${ids.length} row(s)`;
}

export const Default: Story = {
  args: {
    onApproveSelected: alertingAction(rowCountMessage('Approved')),
    onExportSelected: alertingAction(rowCountMessage('Exported')),
  },
};

function rowVendorOrder(canvas: ReturnType<typeof within>) {
  return canvas
    .getAllByRole('checkbox')
    .map((el: HTMLElement) => el.getAttribute('aria-label'))
    .filter((label: string | null): label is string => !!label && label !== 'Select all')
    .map((label: string) => label.replace('Select ', ''));
}

export const RowSelectionAndActions: Story = {
  args: { onApproveSelected: fn(), onExportSelected: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('checkbox', { name: 'Select Amazon Web Services' }));
    await expect(canvas.getByText('1 row selected')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Approve' }));
    await expect(args.onApproveSelected).toHaveBeenCalledWith(['1']);

    await userEvent.click(canvas.getByRole('checkbox', { name: 'Select all' }));
    await expect(canvas.getByText('4 rows selected')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Export' }));
    await expect(args.onExportSelected).toHaveBeenCalledWith(['1', '2', '3', '4']);
  },
};

export const SortByVendor: Story = {
  args: {
    onApproveSelected: alertingAction(rowCountMessage('Approved')),
    onExportSelected: alertingAction(rowCountMessage('Exported')),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(rowVendorOrder(canvas)).toEqual([
      'Amazon Web Services',
      'Figma Inc.',
      'Slack Technologies',
      'WeWork',
    ]);

    await userEvent.click(canvas.getByRole('button', { name: /Vendor/ }));
    await expect(rowVendorOrder(canvas)).toEqual([
      'WeWork',
      'Slack Technologies',
      'Figma Inc.',
      'Amazon Web Services',
    ]);
  },
};

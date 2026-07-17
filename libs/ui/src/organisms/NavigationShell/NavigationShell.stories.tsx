import type { Meta, StoryObj } from '@storybook/react-vite';
import { NavigationShell, type NavigationShellItem } from './NavigationShell';

const meta: Meta<typeof NavigationShell> = {
  title: 'Organisms/NavigationShell',
  component: NavigationShell,
  decorators: [
    // Framed in a fixed-width rail so the vertical stack and full-width active item read in context.
    (Story) => (
      <div className="bg-cl-surface border-cl-border w-53 rounded-xl border p-3">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof NavigationShell>;

const EMPLOYEE_ITEMS: NavigationShellItem[] = [
  { id: 'expenses', icon: 'file-text', label: 'My Expenses' },
  { id: 'cards', icon: 'copy', label: 'My Cards' },
];

const CONTROLLER_ITEMS: NavigationShellItem[] = [
  ...EMPLOYEE_ITEMS,
  { id: 'approvals', icon: 'check', label: 'Approvals', badge: '7' },
  { id: 'reconciliation', icon: 'refresh', label: 'Reconciliation' },
  { id: 'budgets', icon: 'shield', label: 'Budget Management' },
  { id: 'audit-log', icon: 'clock', label: 'Audit Log' },
];

export const Employee: Story = {
  args: { items: EMPLOYEE_ITEMS, activeId: 'expenses' },
};

export const Controller: Story = {
  args: { items: CONTROLLER_ITEMS, activeId: 'approvals' },
};

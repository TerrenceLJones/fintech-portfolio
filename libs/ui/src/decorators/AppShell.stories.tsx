import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppShell } from './AppShell';
import { MoneyDisplay } from '../foundations/MoneyDisplay';
import { BudgetGauge } from '../foundations/BudgetGauge';

const meta: Meta<typeof AppShell> = {
  title: 'Decorators/AppShell',
  component: AppShell,
};
export default meta;

type Story = StoryObj<typeof AppShell>;

export const SpendDashboard: Story = {
  args: {
    title: 'Spend Dashboard',
    children: (
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-cl-surface border-cl-border rounded-xl border p-5">
          <MoneyDisplay amount={487210.5} label="Total spend · June" />
        </div>
        <BudgetGauge label="Engineering" used={23000} total={50000} />
      </div>
    ),
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { BudgetGauge } from './BudgetGauge';

const meta: Meta<typeof BudgetGauge> = {
  title: 'Foundations/BudgetGauge',
  component: BudgetGauge,
};
export default meta;

type Story = StoryObj<typeof BudgetGauge>;

export const OnTrack: Story = { args: { label: 'Engineering', used: 23000, total: 50000 } };
export const Warning80Percent: Story = { args: { label: 'Marketing', used: 40000, total: 50000 } };
export const OverBudget: Story = { args: { label: 'Sales', used: 52000, total: 50000 } };

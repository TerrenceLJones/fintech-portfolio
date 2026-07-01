import type { Meta, StoryObj } from '@storybook/react-vite';
import { MoneyDisplay } from './MoneyDisplay';

const meta: Meta<typeof MoneyDisplay> = {
  title: 'Foundations/MoneyDisplay',
  component: MoneyDisplay,
};
export default meta;

type Story = StoryObj<typeof MoneyDisplay>;

export const Loaded: Story = { args: { amount: 48210, label: 'Available balance' } };
export const Loading: Story = { args: { amount: 48210, state: 'loading' } };
export const Credit: Story = { args: { amount: 5000, state: 'credit', label: 'Inbound transfer' } };
export const Debit: Story = { args: { amount: 12400, state: 'debit', label: 'Vendor payment' } };
export const Derived: Story = { args: { amount: 48210, derived: true } };

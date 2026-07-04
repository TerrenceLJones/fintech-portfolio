import type { Meta, StoryObj } from '@storybook/react-vite';
import { PasswordRequirementsList } from './PasswordRequirementsList';

const meta: Meta<typeof PasswordRequirementsList> = {
  title: 'Molecules/PasswordRequirementsList',
  component: PasswordRequirementsList,
};
export default meta;

type Story = StoryObj<typeof PasswordRequirementsList>;

export const Empty: Story = {
  args: {
    items: [
      { label: 'At least 12 characters', met: false },
      { label: 'Upper & lowercase', met: false },
      { label: 'A number', met: false },
      { label: 'A symbol', met: false },
    ],
  },
};

export const Partial: Story = {
  args: {
    items: [
      { label: 'At least 12 characters', met: true },
      { label: 'Upper & lowercase', met: true },
      { label: 'A number', met: true },
      { label: 'A symbol', met: false },
    ],
  },
};

export const AllMet: Story = {
  args: {
    items: [
      { label: 'At least 12 characters', met: true },
      { label: 'Upper & lowercase', met: true },
      { label: 'A number', met: true },
      { label: 'A symbol', met: true },
    ],
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stepper } from './Stepper';

const meta: Meta<typeof Stepper> = {
  title: 'Molecules/Stepper',
  component: Stepper,
};
export default meta;

type Story = StoryObj<typeof Stepper>;

export const KYBWizard: Story = {
  args: { steps: ['Business', 'Owners', 'Documents', 'Review'], current: 1 },
};

import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { OtpInput } from './OtpInput';

const meta: Meta<typeof OtpInput> = {
  title: 'Molecules/OtpInput',
  component: OtpInput,
};
export default meta;

type Story = StoryObj<typeof OtpInput>;

// OtpInput is fully controlled — the caller owns the code string — so the stories hold it in state.
function ControlledOtpInput(args: ComponentProps<typeof OtpInput>) {
  const [value, setValue] = useState(args.value ?? '');
  return <OtpInput {...args} value={value} onChange={setValue} />;
}

export const Default: Story = {
  args: { label: 'One-time code' },
  render: (args) => <ControlledOtpInput {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Typing advances across the cells and builds the controlled value.
    await userEvent.click(canvas.getByLabelText('One-time code digit 1'));
    await userEvent.keyboard('419');
    await expect(canvas.getByLabelText('One-time code digit 3')).toHaveValue('9');
  },
};

export const Prefilled: Story = {
  args: { label: 'One-time code', value: '419' },
  render: (args) => <ControlledOtpInput {...args} />,
};

export const Error: Story = {
  args: { label: 'One-time code', value: '301298', state: 'error' },
  render: (args) => <ControlledOtpInput {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Every cell is flagged invalid so a wrong code reads unambiguously (US-CW-010 AC-04).
    for (const cell of canvas.getAllByRole('textbox')) {
      await expect(cell).toHaveAttribute('aria-invalid', 'true');
    }
  },
};

export const Disabled: Story = {
  args: { label: 'One-time code', value: '4192', disabled: true },
  render: (args) => <ControlledOtpInput {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('textbox')[0]).toBeDisabled();
  },
};

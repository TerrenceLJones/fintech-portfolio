import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Checkbox } from './Checkbox';

const meta: Meta<typeof Checkbox> = {
  title: 'Atoms/Checkbox',
  component: Checkbox,
};
export default meta;

type Story = StoryObj<typeof Checkbox>;

function ControlledCheckbox(args: ComponentProps<typeof Checkbox>) {
  const [checked, setChecked] = useState(args.checked);
  return (
    <Checkbox
      {...args}
      checked={checked}
      onCheckedChange={(next) => {
        args.onCheckedChange?.(next);
        setChecked(next);
      }}
    />
  );
}

export const Checked: Story = {
  args: { checked: true, 'aria-label': 'Select row', onCheckedChange: fn() },
  render: (args) => <ControlledCheckbox {...args} />,
};
export const Unchecked: Story = {
  args: { checked: false, 'aria-label': 'Select row', onCheckedChange: fn() },
  render: (args) => <ControlledCheckbox {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole('checkbox', { name: 'Select row' });
    await expect(checkbox).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(checkbox);
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true);
  },
};
export const Indeterminate: Story = { args: { indeterminate: true, 'aria-label': 'Select all' } };
export const Disabled: Story = {
  args: { checked: true, disabled: true, 'aria-label': 'Select row', onCheckedChange: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole('checkbox', { name: 'Select row' });
    // Stays enabled/focusable so keyboard/screen-reader users aren't left without an explanation
    // — aria-disabled + Radix's composed click handler block the toggle instead.
    await expect(checkbox).not.toBeDisabled();
    await expect(checkbox).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(checkbox);
    await expect(args.onCheckedChange).not.toHaveBeenCalled();
  },
};

import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Switch } from './Switch';

const meta: Meta<typeof Switch> = {
  title: 'Atoms/Switch',
  component: Switch,
};
export default meta;

type Story = StoryObj<typeof Switch>;

function ControlledSwitch(args: ComponentProps<typeof Switch>) {
  const [checked, setChecked] = useState(args.checked);
  return (
    <Switch
      {...args}
      checked={checked}
      onCheckedChange={(next) => {
        args.onCheckedChange?.(next);
        setChecked(next);
      }}
    />
  );
}

export const On: Story = {
  args: { checked: true, 'aria-label': 'Email', onCheckedChange: fn() },
  render: (args) => <ControlledSwitch {...args} />,
};

export const Off: Story = {
  args: { checked: false, 'aria-label': 'Email', onCheckedChange: fn() },
  render: (args) => <ControlledSwitch {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByRole('switch', { name: 'Email' });
    await expect(control).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(control);
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true);
  },
};

export const Disabled: Story = {
  args: { checked: true, disabled: true, 'aria-label': 'Email', onCheckedChange: fn() },
};

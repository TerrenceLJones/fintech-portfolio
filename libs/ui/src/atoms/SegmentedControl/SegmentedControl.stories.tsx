import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SegmentedControl } from './SegmentedControl';

const meta: Meta<typeof SegmentedControl> = {
  title: 'Atoms/SegmentedControl',
  component: SegmentedControl,
};
export default meta;

type Story = StoryObj<typeof SegmentedControl>;

export const ThemeToggle: Story = {
  args: { options: ['Light', 'Dark'], onChange: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const light = canvas.getByRole('button', { name: 'Light' });
    const dark = canvas.getByRole('button', { name: 'Dark' });
    await expect(light).toHaveAttribute('aria-pressed', 'true');
    await expect(dark).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(dark);
    await expect(dark).toHaveAttribute('aria-pressed', 'true');
    await expect(args.onChange).toHaveBeenCalledWith('Dark');
  },
};
export const DensityToggle: Story = { args: { options: ['Comfortable', 'Compact'] } };

/** Stretched to fill its container with evenly-sized segments — as used in the sidebar rail footer. */
export const FullWidth: Story = {
  args: { options: ['Light', 'Dark'], fullWidth: true },
  decorators: [
    (Story) => (
      <div className="w-53">
        <Story />
      </div>
    ),
  ],
};

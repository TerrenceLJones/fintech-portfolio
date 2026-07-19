import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { UnsavedChangesFooter } from './UnsavedChangesFooter';

const meta: Meta<typeof UnsavedChangesFooter> = {
  title: 'Organisms/UnsavedChangesFooter',
  component: UnsavedChangesFooter,
  args: { onSave: fn(), onDiscard: fn() },
};
export default meta;

type Story = StoryObj<typeof UnsavedChangesFooter>;

export const Visible: Story = {
  args: { visible: true },
  render: (args) => (
    <div className="w-[640px]">
      <UnsavedChangesFooter {...args} />
    </div>
  ),
};

export const Saving: Story = {
  args: { visible: true, saving: true },
  render: (args) => (
    <div className="w-[640px]">
      <UnsavedChangesFooter {...args} />
    </div>
  ),
};

export const Hidden: Story = {
  args: { visible: false },
};

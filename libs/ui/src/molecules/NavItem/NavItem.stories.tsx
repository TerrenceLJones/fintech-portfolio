import type { Meta, StoryObj } from '@storybook/react-vite';
import { NavItem } from './NavItem';

const meta: Meta<typeof NavItem> = {
  title: 'Molecules/NavItem',
  component: NavItem,
  decorators: [
    (Story) => (
      <div className="w-52">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof NavItem>;

export const Default: Story = {
  args: { icon: 'file-text', label: 'My Expenses', onClick: () => window.alert('Navigating to My Expenses') },
};
export const ActiveWithBadge: Story = {
  args: {
    icon: 'check',
    label: 'Approvals',
    active: true,
    badge: '7',
    onClick: () => window.alert('Navigating to Approvals'),
  },
};

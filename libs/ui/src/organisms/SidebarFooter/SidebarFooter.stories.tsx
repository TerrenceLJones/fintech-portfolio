import type { Meta, StoryObj } from '@storybook/react-vite';
import { SidebarFooter } from './SidebarFooter';

const meta: Meta<typeof SidebarFooter> = {
  title: 'Organisms/SidebarFooter',
  component: SidebarFooter,
  decorators: [
    // Framed in a fixed-width rail so the pinned-to-bottom, truncating layout reads in context.
    (Story) => (
      <div className="bg-cl-surface border-cl-border flex h-64 w-53 flex-col rounded-xl border p-3">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof SidebarFooter>;

export const Employee: Story = {
  args: { identity: { name: 'Priya Nair', initials: 'PN', roleLabel: 'Employee' } },
};

export const FinanceManager: Story = {
  args: {
    identity: {
      name: 'Marcus Okafor',
      initials: 'MO',
      roleLabel: 'Finance Manager',
      detail: '$10k limit',
    },
  },
};

export const Controller: Story = {
  args: {
    identity: {
      name: 'Dana Whitfield',
      initials: 'DW',
      roleLabel: 'Controller',
      detail: 'Unlimited',
    },
  },
};

export const LongName: Story = {
  args: {
    identity: {
      name: 'Alexandria Bartholomew-Fitzgerald',
      initials: 'AB',
      roleLabel: 'Finance Manager',
      detail: '$10k limit · Admin',
    },
  },
};

export const Loading: Story = {
  args: { loading: true },
};

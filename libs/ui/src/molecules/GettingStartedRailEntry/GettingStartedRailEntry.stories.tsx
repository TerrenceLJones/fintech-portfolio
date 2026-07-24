import type { Meta, StoryObj } from '@storybook/react-vite';
import { GettingStartedRailEntry } from './GettingStartedRailEntry';
import { alertingAction } from '../../storybook-actions';

const meta: Meta<typeof GettingStartedRailEntry> = {
  title: 'Molecules/GettingStartedRailEntry',
  component: GettingStartedRailEntry,
  decorators: [
    (Story) => (
      <div className="bg-cl-surface w-53 p-3">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof GettingStartedRailEntry>;

export const InProgress: Story = {
  args: { completedCount: 2, totalCount: 4, onClick: alertingAction('Open launchpad') },
};

export const NearComplete: Story = {
  args: { completedCount: 3, totalCount: 4, onClick: alertingAction('Open launchpad') },
};

export const FirstRun: Story = {
  args: { completedCount: 0, totalCount: 4, onClick: alertingAction('Open launchpad') },
};

export const PanelOpen: Story = {
  args: {
    completedCount: 2,
    totalCount: 4,
    open: true,
    onClick: alertingAction('Toggle launchpad'),
  },
};

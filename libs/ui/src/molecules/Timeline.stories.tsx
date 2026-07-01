import type { Meta, StoryObj } from '@storybook/react-vite';
import { Timeline } from './Timeline';

const meta: Meta<typeof Timeline> = {
  title: 'Molecules/Timeline',
  component: Timeline,
};
export default meta;

type Story = StoryObj<typeof Timeline>;

export const AuditTrail: Story = {
  args: {
    entries: [
      {
        actor: 'M. Okafor',
        action: 'approved expense',
        tone: 'positive',
        time: 'Jun 28, 2026 · 14:22:07 PT',
      },
      {
        actor: 'System',
        action: 'routed to L2',
        tone: 'accent',
        time: 'Jun 28, 2026 · 14:21:55 PT',
        diffFrom: 'Pending L1',
        diffTo: 'Pending L2',
      },
      {
        actor: 'D. Reyes',
        action: 'submitted expense · $24,800.00',
        tone: 'neutral',
        time: 'Jun 28, 2026 · 14:18:30 PT',
      },
    ],
  },
};

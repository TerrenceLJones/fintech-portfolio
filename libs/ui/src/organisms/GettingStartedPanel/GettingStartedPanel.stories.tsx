import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { GettingStartedPanel, type GettingStartedTaskView } from './GettingStartedPanel';
import { alertingAction } from '../../storybook-actions';

const meta: Meta<typeof GettingStartedPanel> = {
  title: 'Organisms/GettingStartedPanel',
  component: GettingStartedPanel,
};
export default meta;

type Story = StoryObj<typeof GettingStartedPanel>;

const OWNER_TASKS: GettingStartedTaskView[] = [
  {
    id: 'invite-team',
    title: 'Invite your team',
    description: 'Add teammates so they can submit expenses and get cards.',
    icon: 'users',
    cta: 'Invite',
    status: 'current',
    isSignature: true,
  },
  {
    id: 'set-budget',
    title: 'Set a budget',
    description: 'Give a department a spending limit to track against.',
    icon: 'bar-chart',
    cta: 'Set',
    status: 'upcoming',
    isSignature: false,
  },
  {
    id: 'issue-card',
    title: 'Issue your first virtual card',
    description: 'Create a card with its own limit and controls.',
    icon: 'copy',
    cta: 'Issue',
    status: 'upcoming',
    isSignature: false,
  },
  {
    id: 'read-dashboard',
    title: 'Review your spend dashboard',
    description: 'See spend as it happens across the org.',
    icon: 'bar-chart',
    cta: 'Open',
    status: 'upcoming',
    isSignature: false,
  },
];

export const OwnerFirstRun: Story = {
  args: {
    title: 'Set up your workspace',
    subtitle: 'Four steps to get your team spending safely.',
    completedCount: 0,
    totalCount: 4,
    tasks: OWNER_TASKS,
    onSelectTask: alertingAction('Deep-link to task'),
    onClose: alertingAction('Close panel'),
  },
};

export const ControllerSignatureDone: Story = {
  args: {
    title: 'Get started',
    completedCount: 1,
    totalCount: 3,
    tasks: [
      {
        id: 'issue-card',
        title: 'Issue your first virtual card',
        description: 'Create a card with its own limit and controls.',
        icon: 'copy',
        cta: 'Issue',
        status: 'done',
        isSignature: true,
      },
      {
        id: 'set-budget',
        title: 'Set a budget',
        description: 'Give a department a spending limit to track against.',
        icon: 'bar-chart',
        cta: 'Set',
        status: 'current',
        isSignature: false,
      },
      {
        id: 'review-audit',
        title: 'Review the audit log',
        description: 'See who did what across the organization.',
        icon: 'clock',
        cta: 'Open',
        status: 'upcoming',
        isSignature: false,
      },
    ],
    onSelectTask: alertingAction('Deep-link to task'),
    onClose: alertingAction('Close panel'),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('1 of 3 complete')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Set' }));
  },
};

export const EmployeeTwoTasks: Story = {
  args: {
    title: 'Get started',
    completedCount: 0,
    totalCount: 2,
    tasks: [
      {
        id: 'submit-expense',
        title: 'Submit your first expense',
        description: 'Log a purchase and send it for approval.',
        icon: 'file-text',
        cta: 'Submit',
        status: 'current',
        isSignature: true,
      },
      {
        id: 'see-cards',
        title: 'See your cards',
        description: 'View the cards issued to you and their limits.',
        icon: 'copy',
        cta: 'View',
        status: 'upcoming',
        isSignature: false,
      },
    ],
    onSelectTask: alertingAction('Deep-link to task'),
    onClose: alertingAction('Close panel'),
  },
};

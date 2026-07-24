import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GettingStartedPanel, type GettingStartedTaskView } from './GettingStartedPanel';

const TASKS: GettingStartedTaskView[] = [
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
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof GettingStartedPanel>> = {}) {
  const onSelectTask = vi.fn();
  const onClose = vi.fn();
  render(
    <GettingStartedPanel
      title="Get started"
      completedCount={1}
      totalCount={3}
      tasks={TASKS}
      onSelectTask={onSelectTask}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onSelectTask, onClose };
}

describe('GettingStartedPanel', () => {
  it('renders the title and an explicit "X of N complete" progress label (US-CW-044 AC-02)', () => {
    renderPanel();
    expect(screen.getByText('Get started')).toBeInTheDocument();
    expect(screen.getByText('1 of 3 complete')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });

  it('shows a done task struck through with a Done marker, and the current task with a "Start here"/"Next" badge', () => {
    renderPanel();
    expect(screen.getByText('Issue your first virtual card')).toHaveClass('line-through');
    expect(screen.getByText('Done')).toBeInTheDocument();
    // The current task is not the signature here, so it reads "Next".
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('marks the signature current task "Start here"', () => {
    renderPanel({
      tasks: [{ ...TASKS[1]!, id: 'submit-expense', status: 'current', isSignature: true }],
      completedCount: 0,
      totalCount: 1,
    });
    expect(screen.getByText('Start here')).toBeInTheDocument();
  });

  it('deep-links a task through its action button without any way to mark it done (US-CW-047 AC-02)', async () => {
    const { onSelectTask } = renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Set' }));
    expect(onSelectTask).toHaveBeenCalledWith('set-budget');
    // There is no control anywhere to mark a task complete or skip it.
    expect(
      screen.queryByRole('button', { name: /mark|complete|skip|done/i }),
    ).not.toBeInTheDocument();
  });

  it('closes on the close control (AC-04)', async () => {
    const { onClose } = renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Close getting started' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape (AC-04)', async () => {
    const { onClose } = renderPanel();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows the optional subtitle for the Owner workspace-setup variant', () => {
    renderPanel({
      title: 'Set up your workspace',
      subtitle: 'Four steps to get your team spending safely.',
    });
    expect(screen.getByText('Four steps to get your team spending safely.')).toBeInTheDocument();
  });
});

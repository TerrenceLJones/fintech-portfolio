import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApprovalActionBar } from './ApprovalActionBar';

describe('ApprovalActionBar', () => {
  it('enables Approve and calls onApprove when within limits', async () => {
    const onApprove = vi.fn();
    const user = userEvent.setup();
    render(<ApprovalActionBar canApprove onApprove={onApprove} />);

    const approveButton = screen.getByRole('button', { name: 'Approve' });
    expect(approveButton).toBeEnabled();
    await user.click(approveButton);
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it('disables Approve and shows the reason when a reason is given (separation of duties)', () => {
    render(<ApprovalActionBar reason="You can't approve your own expense." />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getByText("You can't approve your own expense.")).toBeInTheDocument();
  });

  it('shows the Escalate action by default and hides it when showEscalate is false', () => {
    const { rerender } = render(<ApprovalActionBar canApprove />);
    expect(screen.getByRole('button', { name: 'Escalate' })).toBeInTheDocument();

    rerender(<ApprovalActionBar canApprove showEscalate={false} />);
    expect(screen.queryByRole('button', { name: 'Escalate' })).not.toBeInTheDocument();
  });
});

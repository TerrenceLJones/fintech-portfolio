import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RejectReasonDialog } from './RejectReasonDialog';

describe('RejectReasonDialog', () => {
  it('keeps the confirm button disabled until a non-empty reason is entered (AC-02)', async () => {
    const user = userEvent.setup();
    render(<RejectReasonDialog open onOpenChange={() => {}} onConfirm={() => {}} />);

    const confirm = screen.getByRole('button', { name: 'Reject expense' });
    // The Button atom gates via aria-disabled (staying focusable), not the native disabled attribute.
    expect(confirm).toHaveAttribute('aria-disabled', 'true');

    await user.type(screen.getByRole('textbox'), 'Out of policy');
    expect(confirm).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('passes the entered reason to onConfirm', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<RejectReasonDialog open onOpenChange={() => {}} onConfirm={onConfirm} />);

    await user.type(screen.getByRole('textbox'), 'Missing receipt');
    await user.click(screen.getByRole('button', { name: 'Reject expense' }));
    expect(onConfirm).toHaveBeenCalledWith('Missing receipt');
  });

  it('fills the reason from a preset chip', async () => {
    const user = userEvent.setup();
    render(
      <RejectReasonDialog
        open
        onOpenChange={() => {}}
        presets={['Out of policy', 'Duplicate']}
        onConfirm={() => {}}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(screen.getByRole('textbox')).toHaveValue('Duplicate');
    expect(screen.getByRole('button', { name: 'Duplicate' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('uses batch copy and count when rejecting more than one (§7.3)', () => {
    render(<RejectReasonDialog open onOpenChange={() => {}} count={5} onConfirm={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Reject 5 expenses' })).toBeInTheDocument();
    expect(screen.getByText(/notified individually/i)).toBeInTheDocument();
  });
});

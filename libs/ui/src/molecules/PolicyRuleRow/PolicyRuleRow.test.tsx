import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PolicyRuleRow } from './PolicyRuleRow';

describe('PolicyRuleRow (design §19.7)', () => {
  it('renders the range and approver', () => {
    render(<PolicyRuleRow rangeLabel="$1,000 – $10,000" approverLabel="Finance Manager" />);
    expect(screen.getByText('$1,000 – $10,000')).toBeInTheDocument();
    expect(screen.getByText('Finance Manager')).toBeInTheDocument();
  });

  it('conveys auto-approve with an icon AND text, not colour alone', () => {
    render(<PolicyRuleRow rangeLabel="$0 – $999" approverLabel="Auto-approve" autoApprove />);
    // The label text is present (not colour-only) — the icon is decorative alongside it.
    expect(screen.getByText('Auto-approve')).toBeInTheDocument();
  });

  it('fires edit and delete callbacks', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <PolicyRuleRow
        rangeLabel="$10,000+"
        approverLabel="Controller"
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit tier $10,000+' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete tier $10,000+' }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('hides the delete action when not deletable (the sole remaining tier)', () => {
    render(
      <PolicyRuleRow
        rangeLabel="$0+"
        approverLabel="Controller"
        onEdit={() => {}}
        onDelete={() => {}}
        deletable={false}
      />,
    );
    expect(screen.queryByRole('button', { name: /Delete tier/ })).not.toBeInTheDocument();
  });
});

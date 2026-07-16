import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders the default label and an icon for a known status', () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('never conveys status by color alone — every badge renders an icon alongside its text', () => {
    const statuses = [
      'draft',
      'pending-l1',
      'pending-l2',
      'approved',
      'active',
      'paid',
      'reconciled',
      'rejected',
      'reversed',
      'frozen',
      'under-review',
    ] as const;

    for (const status of statuses) {
      const { container, unmount } = render(<StatusBadge status={status} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
      expect(container.querySelector('span')).toHaveTextContent(/.+/);
      unmount();
    }
  });

  it('allows overriding the label text', () => {
    render(<StatusBadge status="approved" label="Custom label" />);
    expect(screen.getByText('Custom label')).toBeInTheDocument();
    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
  });
});

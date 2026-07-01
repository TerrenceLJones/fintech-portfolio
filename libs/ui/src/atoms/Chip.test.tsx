import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chip } from './Chip';

describe('Chip', () => {
  it('renders the label', () => {
    render(<Chip label="Software" />);
    expect(screen.getByText('Software')).toBeInTheDocument();
  });

  it('shows a remove control and calls onRemove when removable', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(<Chip label="Meals" removable onRemove={onRemove} />);

    await user.click(screen.getByRole('button', { name: 'Remove Meals' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('renders no remove control when not removable', () => {
    render(<Chip label="Travel" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

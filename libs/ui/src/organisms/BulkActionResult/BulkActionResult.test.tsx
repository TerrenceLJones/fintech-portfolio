import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkActionResult } from './BulkActionResult';
import { buildBulkActionFailure } from '../../test-factories';

describe('BulkActionResult', () => {
  it('summarizes the successes and failures and lists each failure reason', () => {
    render(
      <BulkActionResult
        total={10}
        failures={[
          buildBulkActionFailure(),
          buildBulkActionFailure({
            name: 'K. Tanaka · $1,420.00',
            reason: 'Already approved by M. Okafor',
          }),
        ]}
      />,
    );
    expect(screen.getByText(/8 of 10 approved/)).toBeInTheDocument();
    expect(screen.getByText('Exceeds your $10,000 limit')).toBeInTheDocument();
    expect(screen.getByText('Already approved by M. Okafor')).toBeInTheDocument();
  });

  it('calls onRetry when retry is clicked', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <BulkActionResult
        total={10}
        failures={[buildBulkActionFailure({ name: 'X', reason: 'Y' })]}
        onRetry={onRetry}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Retry failed/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not commit the failures as successes — the committed count excludes them', () => {
    render(
      <BulkActionResult
        total={10}
        failures={[buildBulkActionFailure({ name: 'X', reason: 'Y' })]}
      />,
    );
    expect(screen.getByText(/9 of 10 approved/)).toBeInTheDocument();
  });

  describe('mid-batch network drop (US-CW-013 AC-03)', () => {
    const props = {
      total: 20,
      succeeded: 5,
      confirmed: ['Priya Nair', 'Dara Reyes'],
      notProcessed: Array.from({ length: 15 }, (_, i) => `Emp ${i + 1}`),
    };

    it('reports the confirmed count and keeps the unprocessed items resumable', () => {
      render(<BulkActionResult {...props} />);
      expect(screen.getByText(/Connection lost mid-batch/)).toBeInTheDocument();
      expect(screen.getByText(/5 of 20 were confirmed/)).toBeInTheDocument();
      expect(screen.getByText(/15 not yet processed/)).toBeInTheDocument();
    });

    it('offers a retry scoped to only the unprocessed items', async () => {
      const onRetry = vi.fn();
      const user = userEvent.setup();
      render(<BulkActionResult {...props} onRetry={onRetry} />);
      await user.click(screen.getByRole('button', { name: /Retry 15 unprocessed/ }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });
});

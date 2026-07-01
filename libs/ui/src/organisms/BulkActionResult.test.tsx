import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkActionResult } from './BulkActionResult';

describe('BulkActionResult', () => {
  it('summarizes the successes and failures and lists each failure reason', () => {
    render(
      <BulkActionResult
        total={10}
        failures={[
          { name: 'D. Reyes · $24,800.00', reason: 'Exceeds your $10,000 limit' },
          { name: 'K. Tanaka · $1,420.00', reason: 'Already approved by M. Okafor' },
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
      <BulkActionResult total={10} failures={[{ name: 'X', reason: 'Y' }]} onRetry={onRetry} />,
    );

    await user.click(screen.getByRole('button', { name: /Retry failed/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not commit the failures as successes — the committed count excludes them', () => {
    render(<BulkActionResult total={10} failures={[{ name: 'X', reason: 'Y' }]} />);
    expect(screen.getByText(/9 of 10 approved/)).toBeInTheDocument();
  });
});

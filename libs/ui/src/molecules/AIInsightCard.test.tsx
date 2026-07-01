import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIInsightCard } from './AIInsightCard';

describe('AIInsightCard', () => {
  it('renders the title, body, and confidence percentage', () => {
    render(
      <AIInsightCard
        title="June spend summary"
        body="June spend totaled $487,210.50."
        confidence={92}
      />,
    );
    expect(screen.getByText('June spend summary')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('renders primary and secondary actions and wires their callbacks', async () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    const user = userEvent.setup();
    render(
      <AIInsightCard
        title="Unusual charge"
        body="4x the usual amount."
        tone="anomaly"
        actionPrimary="Review"
        actionSecondary="Dismiss"
        onActionPrimary={onPrimary}
        onActionSecondary={onSecondary}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Review' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('renders no actions when none are provided', () => {
    render(<AIInsightCard title="Insight" body="Body text" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

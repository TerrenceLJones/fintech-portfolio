import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransactionRow } from './TransactionRow';

describe('TransactionRow', () => {
  it('renders merchant, category/time, and a formatted amount', () => {
    render(
      <TransactionRow merchant="Notion Labs" category="Software" time="just now" amount={150} />,
    );
    expect(screen.getByText('Notion Labs')).toBeInTheDocument();
    expect(screen.getByText('Software · just now')).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();
  });

  it('derives initials from the merchant name when none are given', () => {
    render(
      <TransactionRow
        merchant="Amazon Web Services"
        category="Software"
        time="2h ago"
        amount={48}
      />,
    );
    expect(screen.getByText('Am')).toBeInTheDocument();
  });

  it('renders a declined row with its reason and a struck-through amount (US-CW-014 AC-03/AC-04)', () => {
    render(
      <TransactionRow
        merchant="Vista Grill"
        category="Restaurants"
        time="just now"
        amount={64}
        state="declined"
        declineReason="MCC restricted (Restaurants)"
      />,
    );
    // The reason names itself; a declined charge is signalled by icon + text, never colour alone.
    expect(screen.getByText('Declined · MCC restricted (Restaurants)')).toBeInTheDocument();
    // The amount is struck through because no funds moved.
    const amount = screen.getByText('$64.00');
    expect(amount).toHaveClass('line-through');
  });
});

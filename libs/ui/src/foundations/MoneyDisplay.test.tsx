import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoneyDisplay } from './MoneyDisplay';

describe('MoneyDisplay', () => {
  it('renders a formatted dollar amount by default', () => {
    render(<MoneyDisplay amount={48210} />);
    expect(screen.getByText('$48,210.00')).toBeInTheDocument();
  });

  it('never flashes $0.00 while loading — renders a sized skeleton instead', () => {
    render(<MoneyDisplay amount={48210} state="loading" />);
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    expect(document.querySelector('.cl-skeleton')).toBeInTheDocument();
  });

  it('shows a directional indicator for credit and debit states', () => {
    const { container: creditContainer } = render(<MoneyDisplay amount={5000} state="credit" />);
    expect(creditContainer.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('$5,000.00')).toBeInTheDocument();

    const { container: debitContainer } = render(<MoneyDisplay amount={12400} state="debit" />);
    expect(debitContainer.querySelector('svg')).toBeInTheDocument();
  });

  it('shows the DERIVED · READ-ONLY chip instead of a label when derived is true', () => {
    render(<MoneyDisplay amount={48210} derived label="Available balance" />);
    expect(screen.getByText(/DERIVED/)).toBeInTheDocument();
    expect(screen.queryByText('Available balance')).not.toBeInTheDocument();
  });

  it('shows the label when not derived', () => {
    render(<MoneyDisplay amount={48210} label="Available balance" />);
    expect(screen.getByText('Available balance')).toBeInTheDocument();
  });
});

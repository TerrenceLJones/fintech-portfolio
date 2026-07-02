import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BudgetGauge } from './BudgetGauge';

describe('BudgetGauge', () => {
  it('shows "On track" under 80% usage', () => {
    render(<BudgetGauge label="Engineering" used={23000} total={50000} />);
    expect(screen.getByText('On track')).toBeInTheDocument();
    expect(screen.getByText('46% used')).toBeInTheDocument();
  });

  it('shows a "% used" warning state at or above 80%', () => {
    render(<BudgetGauge label="Marketing" used={40000} total={50000} />);
    expect(screen.getByText('80% used')).toBeInTheDocument();
    expect(screen.getByText('80% of budget used')).toBeInTheDocument();
  });

  it('spells out the exact overage in text when over budget', () => {
    render(<BudgetGauge label="Sales" used={52000} total={50000} />);
    expect(screen.getByText('Over')).toBeInTheDocument();
    expect(screen.getByText('104% — $2,000.00 over')).toBeInTheDocument();
  });
});

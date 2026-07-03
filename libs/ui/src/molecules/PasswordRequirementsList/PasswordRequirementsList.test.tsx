import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PasswordRequirementsList } from './PasswordRequirementsList';

const ITEMS = [
  { label: 'At least 12 characters', met: true },
  { label: 'Upper & lowercase', met: true },
  { label: 'A number', met: false },
  { label: 'A symbol', met: false },
];

describe('PasswordRequirementsList', () => {
  it('renders every item label', () => {
    render(<PasswordRequirementsList items={ITEMS} />);
    expect(screen.getByText('At least 12 characters')).toBeInTheDocument();
    expect(screen.getByText('Upper & lowercase')).toBeInTheDocument();
    expect(screen.getByText('A number')).toBeInTheDocument();
    expect(screen.getByText('A symbol')).toBeInTheDocument();
  });

  it('renders a check icon for met requirements and an x-circle for unmet ones', () => {
    const { container } = render(<PasswordRequirementsList items={ITEMS} />);
    const rows = container.querySelectorAll('[data-requirement-met]');

    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveAttribute('data-requirement-met', 'true');
    expect(rows[1]).toHaveAttribute('data-requirement-met', 'true');
    expect(rows[2]).toHaveAttribute('data-requirement-met', 'false');
    expect(rows[3]).toHaveAttribute('data-requirement-met', 'false');
  });

  it('renders nothing when items is empty', () => {
    const { container } = render(<PasswordRequirementsList items={[]} />);
    expect(container.querySelectorAll('[data-requirement-met]')).toHaveLength(0);
  });
});

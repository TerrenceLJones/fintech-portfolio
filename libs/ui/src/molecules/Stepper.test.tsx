import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Stepper } from './Stepper';

describe('Stepper', () => {
  it('renders all step labels', () => {
    render(<Stepper steps={['Business', 'Owners', 'Review']} current={1} />);
    expect(screen.getByText('Business')).toBeInTheDocument();
    expect(screen.getByText('Owners')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('marks steps before current as done with a checkmark', () => {
    const { container } = render(<Stepper steps={['Business', 'Owners', 'Review']} current={2} />);
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });

  it('shows the step number for the current and upcoming steps', () => {
    render(<Stepper steps={['Business', 'Owners', 'Review']} current={0} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

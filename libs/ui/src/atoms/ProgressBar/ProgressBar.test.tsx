import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('exposes value/min/max via ARIA for assistive tech', () => {
    render(<ProgressBar value={46} label="Software" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '46');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('exposes an accessible name via aria-label', () => {
    render(<ProgressBar value={46} label="Software" />);
    expect(screen.getByRole('progressbar', { name: 'Software' })).toBeInTheDocument();
  });

  it('clamps the visual fill width to 100% even if value exceeds max', () => {
    const { container } = render(<ProgressBar value={150} max={100} label="Software" />);
    const fill = container.querySelector('[style*="width"]') as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });
});

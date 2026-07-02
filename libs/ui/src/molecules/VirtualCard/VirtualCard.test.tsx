import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VirtualCard } from './VirtualCard';

describe('VirtualCard', () => {
  it('renders the masked PAN and derived remaining limit when active', () => {
    render(<VirtualCard holder="D. Reyes — Design" last4="4021" remaining={1850} exp="09/28" />);
    expect(screen.getByText(/4021/)).toBeInTheDocument();
    expect(screen.getByText('$1,850.00')).toBeInTheDocument();
  });

  it('shows a "Frozen" label (icon + text, not color alone) and hides the remaining limit when frozen', () => {
    render(<VirtualCard holder="S. Park — Sales" last4="5567" exp="09/28" state="frozen" />);
    expect(screen.getByText('Frozen')).toBeInTheDocument();
    expect(screen.getByText('Not authorizing')).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
});

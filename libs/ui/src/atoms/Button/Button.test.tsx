import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders its label and responds to clicks', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button label="Approve" onClick={onClick} />);

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('blocks clicks while loading but stays focusable and announces busy state', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button label="Processing" loading onClick={onClick}>
        Processing
      </Button>,
    );

    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    button.focus();
    expect(button).toHaveFocus();

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is disabled when the disabled prop is set', () => {
    render(<Button label="Approve" disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('prefers children over the label prop', () => {
    render(<Button label="fallback">Actual content</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Actual content');
  });
});

import type { SubmitEvent } from 'react';
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

  it('blocks clicks while loading but stays focusable and announces busy/disabled state', async () => {
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
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveClass('cursor-not-allowed');

    button.focus();
    expect(button).toHaveFocus();

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not resubmit its parent form while loading, even though it stays enabled', async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" label="Sign in" loading />
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits its parent form on click when not loading', async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" label="Sign in" />
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('blocks clicks while disabled but stays focusable and announces disabled state', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button label="Approve" disabled onClick={onClick} />);

    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveClass('cursor-not-allowed');

    button.focus();
    expect(button).toHaveFocus();

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not resubmit its parent form while disabled, even though it stays enabled', async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" label="Sign in" disabled />
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('prefers children over the label prop', () => {
    render(<Button label="fallback">Actual content</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Actual content');
  });

  it('renders the link variant as bare inline text — no box padding or border', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button variant="link" onClick={onClick}>
        Back to sign in
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Back to sign in' });
    expect(button).not.toHaveClass('rounded-lg');
    expect(button.className).not.toMatch(/\bpx-\d/);
    expect(button).toHaveClass('p-0');

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

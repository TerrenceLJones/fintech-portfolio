import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordField } from './PasswordField';

describe('PasswordField', () => {
  it('masks the value by default and reveals it when the toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<PasswordField label="Password" defaultValue="secret123" />);

    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('passes through other TextField props such as error state', () => {
    render(<PasswordField label="Password" state="error" error="Incorrect email or password" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Incorrect email or password');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables the reveal toggle when the field is disabled', () => {
    render(<PasswordField label="Password" disabled defaultValue="secret123" />);

    expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();
  });
});

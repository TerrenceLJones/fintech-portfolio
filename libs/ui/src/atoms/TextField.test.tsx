import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextField } from './TextField';

describe('TextField', () => {
  it('associates the label with the input and accepts typed input', async () => {
    const user = userEvent.setup();
    render(<TextField label="Work email" />);

    const input = screen.getByLabelText('Work email');
    await user.type(input, 'dreyes@northwind.example');
    expect(input).toHaveValue('dreyes@northwind.example');
  });

  it('shows the error message and marks the field invalid when state is error', () => {
    render(<TextField label="Password" state="error" error="Incorrect password" />);

    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Incorrect password');
  });

  it('disables the input when state is disabled', () => {
    render(<TextField label="Account" state="disabled" />);
    expect(screen.getByLabelText('Account')).toBeDisabled();
  });

  it('renders prefix and suffix content', () => {
    render(<TextField label="Amount" prefix="$" suffix="USD" defaultValue="5,000.00" />);
    expect(screen.getByText('$')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
  });
});

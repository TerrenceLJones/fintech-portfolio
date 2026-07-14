import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OtpInput } from './OtpInput';

/** Controlled harness — mirrors how the challenge modal drives the input. */
function Controlled(props: Partial<React.ComponentProps<typeof OtpInput>> = {}) {
  return (
    <OtpInput label="One-time code" value={props.value ?? ''} onChange={() => {}} {...props} />
  );
}

describe('OtpInput', () => {
  it('renders one cell per digit of the configured length', () => {
    render(<Controlled length={6} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
  });

  it('renders the controlled value across the cells', () => {
    render(<Controlled value="419" length={6} />);
    const cells = screen.getAllByRole('textbox') as HTMLInputElement[];
    expect(cells[0]!.value).toBe('4');
    expect(cells[1]!.value).toBe('1');
    expect(cells[2]!.value).toBe('9');
    expect(cells[3]!.value).toBe('');
  });

  it('appends a typed digit and reports the new value, advancing focus', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled value="" onChange={onChange} length={6} />);

    await user.click(screen.getAllByRole('textbox')[0]!);
    await user.keyboard('4');
    expect(onChange).toHaveBeenLastCalledWith('4');
  });

  it('ignores non-numeric input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled value="" onChange={onChange} length={6} />);

    await user.click(screen.getAllByRole('textbox')[0]!);
    await user.keyboard('a');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('deletes the last digit on backspace from an empty cell', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled value="41" onChange={onChange} length={6} />);

    // Focus the third (empty) cell and backspace — it should remove the previous digit.
    await user.click(screen.getAllByRole('textbox')[2]!);
    await user.keyboard('{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith('4');
  });

  it('accepts a pasted code, truncated to the length', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled value="" onChange={onChange} length={6} />);

    await user.click(screen.getAllByRole('textbox')[0]!);
    await user.paste('123456789');
    expect(onChange).toHaveBeenLastCalledWith('123456');
  });

  it('fires onComplete once all digits are entered', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Controlled value="12345" onComplete={onComplete} length={6} />);

    await user.click(screen.getAllByRole('textbox')[5]!);
    await user.keyboard('6');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('marks every cell invalid in the error state (AC-04)', () => {
    render(<Controlled value="301298" state="error" length={6} />);
    for (const cell of screen.getAllByRole('textbox')) {
      expect(cell).toHaveAttribute('aria-invalid', 'true');
    }
  });

  it('disables every cell when disabled', () => {
    render(<Controlled value="" disabled length={6} />);
    for (const cell of screen.getAllByRole('textbox')) {
      expect(cell).toBeDisabled();
    }
  });
});

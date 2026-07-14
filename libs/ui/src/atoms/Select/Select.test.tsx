import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select, type SelectOption } from './Select';

const OPTIONS: SelectOption[] = [
  { value: 'ach', label: 'ACH', description: 'Standard rail', meta: 'Free' },
  { value: 'wire', label: 'Wire', description: 'Same day', meta: 'Free' },
  {
    value: 'check',
    label: 'Check',
    description: 'Not enabled',
    disabled: true,
    disabledMeta: 'OFF',
  },
];

// Radix Select's open/keyboard behaviour is exercised in the browser via Select.stories.tsx;
// happy-dom lacks the pointer/scroll primitives Radix needs to open the listbox. These unit
// tests cover the deterministic closed-trigger surface.
describe('Select', () => {
  it('exposes the trigger as a named combobox echoing the selected label', () => {
    render(<Select aria-label="Method" value="wire" onValueChange={() => {}} options={OPTIONS} />);
    const trigger = screen.getByRole('combobox', { name: 'Method' });
    expect(trigger).toHaveTextContent('Wire');
  });

  it('marks the trigger aria-disabled but keeps it focusable when the control is disabled', () => {
    render(
      <Select
        aria-label="Method"
        value="ach"
        onValueChange={() => {}}
        disabled
        options={OPTIONS}
      />,
    );
    // Native `disabled` would drop the trigger from the tab order and a11y tree; instead we mark it
    // aria-disabled and keep it focusable so keyboard/screen-reader users don't lose it.
    const trigger = screen.getByRole('combobox', { name: 'Method' });
    expect(trigger).not.toBeDisabled();
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    trigger.focus();
    expect(trigger).toHaveFocus();
  });
});

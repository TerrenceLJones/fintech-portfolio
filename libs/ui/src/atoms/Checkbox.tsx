import { Checkbox as RadixCheckbox } from 'radix-ui';
import { Icon } from '@fintech-portfolio/icons';

export interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  size?: number;
  onCheckedChange?: (checked: boolean) => void;
  'aria-label'?: string;
}

/** Wraps Radix `Checkbox` for focus/keyboard/ARIA handling rather than reimplementing it by hand. */
export function Checkbox({
  checked,
  indeterminate = false,
  disabled = false,
  size = 16,
  onCheckedChange,
  ...rest
}: CheckboxProps) {
  const radixChecked = indeterminate ? 'indeterminate' : checked;
  const on = !!checked || indeterminate;

  return (
    <RadixCheckbox.Root
      checked={radixChecked}
      disabled={disabled}
      onCheckedChange={(next) => onCheckedChange?.(next === true)}
      className={[
        'focus-visible:ring-cl-focus box-border inline-flex items-center justify-center rounded outline-none focus-visible:ring-3',
        on
          ? 'bg-cl-accent border-cl-accent border-[1.5px]'
          : 'border-cl-border-2 bg-cl-surface border-[1.5px]',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      ].join(' ')}
      style={{ width: size, height: size }}
      {...rest}
    >
      <RadixCheckbox.Indicator className="flex items-center justify-center text-white">
        <Icon name={indeterminate ? 'minus' : 'check'} size={size - 5} stroke={2.4} />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
}

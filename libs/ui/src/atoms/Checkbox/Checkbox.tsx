import { Checkbox as RadixCheckbox } from 'radix-ui';
import { Icon } from '@fintech-portfolio/icons';
import { useDisabledGuard } from '../../utils/useDisabledGuard';

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
  // Deliberately NOT passing `disabled` to Radix's Root — Radix renders it as the native HTML
  // `disabled` attribute, which drops the control from the tab order/accessibility tree. Instead
  // we set `aria-disabled` and rely on Radix's own onClick composition (via
  // `@radix-ui/primitive`'s `composeEventHandlers`, which runs the consumer's `onClick` first and
  // skips Radix's internal toggle if `event.defaultPrevented`) to suppress the state change while
  // keeping the checkbox focusable. Verified against radix-ui@^1.6.1 / @radix-ui/react-checkbox
  // 1.3.6's source — a future Radix major bump that changes this composition needs a human look.
  const guard = useDisabledGuard<HTMLButtonElement>(disabled);

  return (
    <RadixCheckbox.Root
      checked={radixChecked}
      aria-disabled={guard['aria-disabled']}
      onClick={guard.onClick}
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

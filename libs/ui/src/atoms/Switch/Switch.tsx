import { Switch as RadixSwitch } from 'radix-ui';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name — required when there's no visible <label> wired to it. */
  'aria-label'?: string;
}

/**
 * The pill on/off toggle from design §19.6 (NotificationToggle's channel switches), built on Radix
 * `Switch` so focus, keyboard (Space/Enter) and `role="switch"` + `aria-checked` come from the
 * primitive rather than being hand-rolled. Accent track when on, neutral when off; the thumb slides
 * — state is never conveyed by color alone because the control also carries switch semantics and an
 * accessible name.
 */
export function Switch({ checked, onCheckedChange, disabled = false, ...rest }: SwitchProps) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={[
        'focus-visible:ring-cl-focus inline-flex h-5 w-[34px] flex-shrink-0 items-center rounded-full p-0.5 outline-none transition-colors focus-visible:ring-3',
        checked ? 'bg-cl-accent' : 'bg-cl-border-2',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      ].join(' ')}
      {...rest}
    >
      <RadixSwitch.Thumb className="block h-4 w-4 rounded-full bg-white transition-transform data-[state=checked]:translate-x-3.5" />
    </RadixSwitch.Root>
  );
}

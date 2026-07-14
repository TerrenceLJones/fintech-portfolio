import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { Select as RadixSelect } from 'radix-ui';
import { Icon } from '../../foundations/Icon';
import { Text } from '../Text';
import { useDisabledGuard } from '../../utils/useDisabledGuard';

export interface SelectOption {
  /** The value emitted via `onValueChange` when this row is chosen. */
  value: string;
  /** Primary label — the only part echoed into the closed trigger. */
  label: string;
  /** Secondary line beneath the label (e.g. "Standard rail · arrives in 1–2 business days"). */
  description?: string;
  /** Trailing content on the label row (e.g. a currency-formatted fee). */
  meta?: ReactNode;
  /** Trailing content shown instead of `meta` when the row is disabled (e.g. an "OFF" chip). */
  disabledMeta?: ReactNode;
  /** A non-selectable row — kept visible (with its reason) rather than hidden, so the option set reads complete. */
  disabled?: boolean;
  /** Draw a divider above this row (e.g. to fence off disabled rails). */
  separatorBefore?: boolean;
}

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  /** Accessible name for the trigger — required when there's no visible <label> wired to it. */
  'aria-label'?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Extra classes for the trigger box. */
  className?: string;
}

/**
 * A single-select dropdown built on Radix `Select` — the listbox semantics, keyboard navigation,
 * typeahead, focus management and ARIA wiring come from the primitive rather than being hand-rolled.
 * Unlike a native `<select>`, each option renders a rich row (label + description + trailing meta),
 * disabled options stay visible with their reason, and the chosen row carries a check — matching the
 * design's Method listbox. The trigger echoes only the selected option's `label`.
 */
export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: SelectProps) {
  // Deliberately NOT passing `disabled` to Radix's Root — Radix renders it as the native HTML
  // `disabled` attribute on the trigger, which drops it from the tab order and the accessibility
  // tree (matching Checkbox's stance). Instead we mark the trigger `aria-disabled` and neutralize
  // every vector Radix opens/mutates on. Unlike Checkbox (which only toggles on click), a Select
  // trigger opens on pointerdown and on keydown (Enter/Space/Arrows), and mutates the value via
  // typeahead even while closed — so we intercept pointerdown/keydown too. Radix composes consumer
  // handlers before its own and skips its own when the event is `defaultPrevented`
  // (`@radix-ui/primitive`'s `composeEventHandlers`), so preventing default here keeps the trigger
  // focusable while making it inert. Verified against @radix-ui/react-select 2.x — a Radix major
  // bump that changes this composition needs a human look.
  const guard = useDisabledGuard<HTMLButtonElement>(disabled);
  const inertHandlers = disabled
    ? {
        onPointerDown: (event: PointerEvent<HTMLButtonElement>) => event.preventDefault(),
        // Let Tab/Shift+Tab through so focus can still leave the disabled trigger; suppress every
        // other key, which covers Radix's open keys and the closed-trigger typeahead.
        onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
          if (event.key !== 'Tab') event.preventDefault();
        },
      }
    : undefined;
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger
        aria-label={ariaLabel}
        aria-disabled={guard['aria-disabled']}
        onClick={guard.onClick}
        {...inertHandlers}
        className={[
          'group border-cl-border-2 bg-cl-surface text-cl-text data-[state=open]:border-cl-accent data-[state=open]:ring-cl-accent-weak focus:border-cl-accent focus:ring-cl-accent-weak flex w-full items-center justify-between gap-2 rounded-lg border py-[11px] pr-3.5 pl-3.5 text-[13px] font-medium outline-none focus:ring-3 data-[state=open]:ring-3',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon className="text-cl-text-3">
          <Icon
            name="chevron-down"
            size={12}
            className="transition-transform group-data-[state=open]:rotate-180"
          />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          className="border-cl-border-2 bg-cl-surface z-50 min-w-[var(--radix-select-trigger-width)] rounded-xl border p-1.5 shadow-2xl"
        >
          <RadixSelect.Viewport>
            {options.map((option) => (
              <SelectRow key={option.value} option={option} />
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

function SelectRow({ option }: { option: SelectOption }) {
  const trailing = option.disabled ? (option.disabledMeta ?? option.meta) : option.meta;
  return (
    <>
      {option.separatorBefore ? (
        <RadixSelect.Separator className="bg-cl-border mx-2 my-1 h-px" />
      ) : null}
      <RadixSelect.Item
        value={option.value}
        disabled={option.disabled}
        className="group data-[highlighted]:bg-cl-surface-2 data-[state=checked]:bg-cl-accent-weak flex cursor-pointer items-start gap-2.5 rounded-lg px-2.75 py-2.5 outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-55"
      >
        <span className="text-cl-accent-text w-3.5 flex-shrink-0 pt-0.5">
          <RadixSelect.ItemIndicator>
            <Icon name="check" size={14} stroke={2.4} />
          </RadixSelect.ItemIndicator>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="group-data-[state=checked]:text-cl-accent-text text-cl-text text-[13px] font-semibold">
              <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
            </span>
            {trailing != null ? (
              <Text as="span" size="mono" tone="muted" className="flex-shrink-0 tabular-nums">
                {trailing}
              </Text>
            ) : null}
          </span>
          {option.description ? (
            <Text as="span" size="label" tone="faint" className="mt-0.5 block">
              {option.description}
            </Text>
          ) : null}
        </span>
      </RadixSelect.Item>
    </>
  );
}

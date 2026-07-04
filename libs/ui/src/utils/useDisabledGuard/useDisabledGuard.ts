import type { MouseEvent } from 'react';

export interface DisabledGuard<E extends HTMLElement = HTMLButtonElement> {
  'aria-disabled': true | undefined;
  onClick: (event: MouseEvent<E>) => void;
}

/**
 * The "looks and acts disabled, but stays focusable and in the accessibility tree" pattern.
 * Sets `aria-disabled` (never the native `disabled` attribute) and wraps the caller's click
 * handler so activating the control while `isInert` is a no-op. Calling `event.preventDefault()`
 * (rather than just skipping the handler) also blocks a `type="submit"` button's implicit-submit
 * synthetic click on Enter, so a guarded submit button can't resubmit its form while it stays
 * enabled/focusable for assistive technology.
 */
export function useDisabledGuard<E extends HTMLElement = HTMLButtonElement>(
  isInert: boolean,
  onClick?: (event: MouseEvent<E>) => void,
): DisabledGuard<E> {
  return {
    'aria-disabled': isInert || undefined,
    onClick(event) {
      if (isInert) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
    },
  };
}

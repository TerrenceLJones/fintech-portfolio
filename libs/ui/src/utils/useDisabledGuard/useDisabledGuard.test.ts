import type { MouseEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useDisabledGuard } from './useDisabledGuard';

function fakeClickEvent() {
  return { preventDefault: vi.fn() } as unknown as MouseEvent<HTMLButtonElement>;
}

describe('useDisabledGuard', () => {
  it('omits aria-disabled and forwards clicks when not inert', () => {
    const onClick = vi.fn();
    const guard = useDisabledGuard(false, onClick);
    expect(guard['aria-disabled']).toBeUndefined();

    const event = fakeClickEvent();
    guard.onClick(event);
    expect(onClick).toHaveBeenCalledWith(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('sets aria-disabled and swallows clicks via preventDefault when inert', () => {
    const onClick = vi.fn();
    const guard = useDisabledGuard(true, onClick);
    expect(guard['aria-disabled']).toBe(true);

    const event = fakeClickEvent();
    guard.onClick(event);
    expect(onClick).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('works with no onClick provided', () => {
    const guard = useDisabledGuard(false);
    expect(() => guard.onClick(fakeClickEvent())).not.toThrow();
  });
});

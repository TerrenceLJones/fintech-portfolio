import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { isUuidV4 } from '@clearline/domain-payments';
import { useIdempotencyKey } from './use-idempotency-key';

describe('useIdempotencyKey', () => {
  it('mints one stable UUID v4 key that survives re-renders', () => {
    const { result, rerender } = renderHook(() => useIdempotencyKey());
    const initial = result.current.key;
    expect(isUuidV4(initial)).toBe(true);
    rerender();
    expect(result.current.key).toBe(initial);
  });

  it('mints a fresh key on reset (a genuinely new operation)', () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const first = result.current.key;
    act(() => result.current.reset());
    expect(result.current.key).not.toBe(first);
    expect(isUuidV4(result.current.key)).toBe(true);
  });
});

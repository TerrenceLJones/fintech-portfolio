import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useInactivityTimer } from './use-inactivity-timer';

const MINUTE = 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useInactivityTimer', () => {
  it('starts active and stays active before the 14-minute mark', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useInactivityTimer({ onExpire }));

    act(() => {
      vi.advanceTimersByTime(13 * MINUTE);
    });

    expect(result.current.phase).toBe('active');
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('enters warning at the 14-minute mark with 60 seconds remaining (AC-04)', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useInactivityTimer({ onExpire }));

    act(() => {
      vi.advanceTimersByTime(14 * MINUTE);
    });

    expect(result.current.phase).toBe('warning');
    expect(result.current.secondsRemaining).toBe(60);
  });

  it('calls onExpire exactly once at the 15-minute cutoff, not again on later ticks (AC-04)', () => {
    const onExpire = vi.fn();
    renderHook(() => useInactivityTimer({ onExpire }));

    act(() => {
      vi.advanceTimersByTime(15 * MINUTE);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5 * MINUTE);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('resets the timer back to active on page activity during the warning phase (AC-05)', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useInactivityTimer({ onExpire }));

    act(() => {
      vi.advanceTimersByTime(14 * MINUTE);
    });
    expect(result.current.phase).toBe('warning');

    act(() => {
      window.dispatchEvent(new Event('keydown'));
    });
    expect(result.current.phase).toBe('active');

    act(() => {
      vi.advanceTimersByTime(14 * MINUTE);
    });
    expect(result.current.phase).toBe('warning');
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("does not reset on mere pointer movement, so hovering toward the warning modal's own buttons cannot dismiss it before a click lands", () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useInactivityTimer({ onExpire }));

    act(() => {
      vi.advanceTimersByTime(14 * MINUTE);
    });
    expect(result.current.phase).toBe('warning');

    act(() => {
      window.dispatchEvent(new Event('mousemove'));
    });
    expect(result.current.phase).toBe('warning');
  });

  it('resets the timer via the returned resetTimer function (the "Stay signed in" action)', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useInactivityTimer({ onExpire }));

    act(() => {
      vi.advanceTimersByTime(14 * MINUTE);
    });
    expect(result.current.phase).toBe('warning');

    act(() => {
      result.current.resetTimer();
    });
    expect(result.current.phase).toBe('active');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCountdown } from './useCountdown';

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('ticks every second inside the last five minutes', () => {
    const cutoff = new Date(Date.now() + 4 * 60_000 + 10_000).toISOString();
    const { result } = renderHook(() => useCountdown(cutoff));
    expect(result.current.label).toBe('4m 10s');
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.label).toBe('4m 07s');
  });

  it('flips to ended and stops ticking', () => {
    const cutoff = new Date(Date.now() + 2000).toISOString();
    const { result } = renderHook(() => useCountdown(cutoff));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.ended).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears its timer on unmount', () => {
    const cutoff = new Date(Date.now() + 3600_000).toISOString();
    const { unmount } = renderHook(() => useCountdown(cutoff));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('copes with a missing date', () => {
    const { result } = renderHook(() => useCountdown(undefined));
    expect(result.current.ended).toBe(true);
  });
});

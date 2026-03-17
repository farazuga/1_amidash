// src/hooks/__tests__/use-debounce.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../use-debounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('does not update the value before the delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } },
    );

    rerender({ value: 'updated', delay: 300 });

    // Advance less than the delay
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe('initial');
  });

  it('updates the value after the delay passes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } },
    );

    rerender({ value: 'updated', delay: 300 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('updated');
  });

  it('only emits the last value when changed rapidly', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 500 } },
    );

    // Rapid changes
    rerender({ value: 'b', delay: 500 });
    act(() => { vi.advanceTimersByTime(100); });

    rerender({ value: 'c', delay: 500 });
    act(() => { vi.advanceTimersByTime(100); });

    rerender({ value: 'd', delay: 500 });
    act(() => { vi.advanceTimersByTime(100); });

    // Still showing initial since no full delay has elapsed since last change
    expect(result.current).toBe('a');

    // Advance past the delay from the last change
    act(() => { vi.advanceTimersByTime(500); });

    expect(result.current).toBe('d');
  });

  it('uses default delay of 300ms when not specified', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: 'start' } },
    );

    rerender({ value: 'end' });

    act(() => { vi.advanceTimersByTime(299); });
    expect(result.current).toBe('start');

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe('end');
  });

  it('cleans up the timer on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { unmount, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'test' } },
    );

    // Trigger a rerender so a timeout is scheduled
    rerender({ value: 'changed' });

    const callsBefore = clearTimeoutSpy.mock.calls.length;
    unmount();

    // clearTimeout should have been called during cleanup
    expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(callsBefore);

    clearTimeoutSpy.mockRestore();
  });

  it('resets the timer when value changes before delay expires', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'first', delay: 300 } },
    );

    rerender({ value: 'second', delay: 300 });

    // Advance 250ms (within delay)
    act(() => { vi.advanceTimersByTime(250); });
    expect(result.current).toBe('first');

    // Change value again -- resets the timer
    rerender({ value: 'third', delay: 300 });

    // Advance another 250ms -- total 500ms since first change but only 250ms since last change
    act(() => { vi.advanceTimersByTime(250); });
    expect(result.current).toBe('first');

    // Advance past the full delay from the last change
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current).toBe('third');
  });

  it('works with non-string types', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 42, delay: 200 } },
    );

    rerender({ value: 99, delay: 200 });

    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe(99);
  });

  it('respects different delay values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'fast', delay: 100 } },
    );

    rerender({ value: 'slow', delay: 1000 });

    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe('fast');

    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe('slow');
  });
});

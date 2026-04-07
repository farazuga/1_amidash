// src/hooks/__tests__/use-keyboard-shortcuts.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from '../use-keyboard-shortcuts';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}));

describe('useKeyboardShortcuts', () => {
  it('calls handler for simple key shortcut', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ keys: 'n', handler }]));
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' })); });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores shortcuts when typing in input', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ keys: 'n', handler }]));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true })); });
    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('handles modifier combos (mod+k)', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ keys: 'mod+k', handler }]));
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true })); });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handles chord sequences (g then d)', () => {
    const handler = vi.fn();
    vi.useFakeTimers();
    renderHook(() => useKeyboardShortcuts([{ keys: 'g d', handler }]));
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' })); });
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' })); });
    expect(handler).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('chord sequence times out after 1000ms', () => {
    const handler = vi.fn();
    vi.useFakeTimers();
    renderHook(() => useKeyboardShortcuts([{ keys: 'g d', handler }]));
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' })); });
    act(() => { vi.advanceTimersByTime(1100); });
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' })); });
    expect(handler).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

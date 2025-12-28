import { describe, it, expect, beforeEach } from 'vitest';
import { useSidebarStore } from '../sidebar-store';

describe('useSidebarStore', () => {
  beforeEach(() => {
    // Reset the store state before each test
    useSidebarStore.setState({ isOpen: false });
  });

  it('initializes with closed state', () => {
    const state = useSidebarStore.getState();
    expect(state.isOpen).toBe(false);
  });

  it('opens sidebar with open()', () => {
    const { open } = useSidebarStore.getState();
    open();

    const state = useSidebarStore.getState();
    expect(state.isOpen).toBe(true);
  });

  it('closes sidebar with close()', () => {
    useSidebarStore.setState({ isOpen: true });

    const { close } = useSidebarStore.getState();
    close();

    const state = useSidebarStore.getState();
    expect(state.isOpen).toBe(false);
  });

  it('toggles sidebar from closed to open', () => {
    const { toggle } = useSidebarStore.getState();
    toggle();

    const state = useSidebarStore.getState();
    expect(state.isOpen).toBe(true);
  });

  it('toggles sidebar from open to closed', () => {
    useSidebarStore.setState({ isOpen: true });

    const { toggle } = useSidebarStore.getState();
    toggle();

    const state = useSidebarStore.getState();
    expect(state.isOpen).toBe(false);
  });

  it('multiple toggles work correctly', () => {
    const { toggle } = useSidebarStore.getState();

    toggle();
    expect(useSidebarStore.getState().isOpen).toBe(true);

    toggle();
    expect(useSidebarStore.getState().isOpen).toBe(false);

    toggle();
    expect(useSidebarStore.getState().isOpen).toBe(true);
  });

  it('open() is idempotent when already open', () => {
    useSidebarStore.setState({ isOpen: true });

    const { open } = useSidebarStore.getState();
    open();

    expect(useSidebarStore.getState().isOpen).toBe(true);
  });

  it('close() is idempotent when already closed', () => {
    useSidebarStore.setState({ isOpen: false });

    const { close } = useSidebarStore.getState();
    close();

    expect(useSidebarStore.getState().isOpen).toBe(false);
  });
});

'use client';

import { useEffect, useRef, useCallback } from 'react';

interface ShortcutBinding {
  keys: string;
  handler: () => void;
}

function isTypingInInput(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement;
  if (!target || !target.tagName) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable ||
    (typeof target.closest === 'function' && target.closest('[role="combobox"]') !== null) ||
    (typeof target.closest === 'function' && target.closest('[cmdk-input]') !== null)
  );
}

function parseKeys(keys: string): { isChord: boolean; parts: string[] } {
  const parts = keys.split(' ');
  return { isChord: parts.length > 1, parts };
}

function matchesModifierCombo(e: KeyboardEvent, keys: string): boolean {
  const parts = keys.split('+');
  const key = parts.pop()!;
  const modifiers = parts;
  if (e.key.toLowerCase() !== key.toLowerCase()) return false;
  const needsMod = modifiers.includes('mod');
  const hasMod = e.metaKey || e.ctrlKey;
  if (needsMod && !hasMod) return false;
  if (!needsMod && (e.metaKey || e.ctrlKey)) return false;
  return true;
}

export function useKeyboardShortcuts(bindings: ShortcutBinding[]) {
  const chordBuffer = useRef<string | null>(null);
  const chordTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  const clearChord = useCallback(() => {
    chordBuffer.current = null;
    if (chordTimeout.current) {
      clearTimeout(chordTimeout.current);
      chordTimeout.current = null;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const escBinding = bindingsRef.current.find((b) => b.keys === 'Escape');
        if (escBinding) escBinding.handler();
        return;
      }

      const hasModifier = e.metaKey || e.ctrlKey;
      if (isTypingInInput(e) && !hasModifier) return;

      if (chordBuffer.current) {
        const firstKey = chordBuffer.current;
        clearChord();
        const match = bindingsRef.current.find((b) => {
          const { isChord, parts } = parseKeys(b.keys);
          return isChord && parts[0] === firstKey && parts[1] === e.key.toLowerCase();
        });
        if (match) { e.preventDefault(); match.handler(); }
        return;
      }

      if (hasModifier) {
        const match = bindingsRef.current.find(
          (b) => b.keys.includes('+') && matchesModifierCombo(e, b.keys)
        );
        if (match) { e.preventDefault(); match.handler(); }
        return;
      }

      const startsChord = bindingsRef.current.some((b) => {
        const { isChord, parts } = parseKeys(b.keys);
        return isChord && parts[0] === e.key.toLowerCase();
      });
      if (startsChord) {
        chordBuffer.current = e.key.toLowerCase();
        chordTimeout.current = setTimeout(clearChord, 1000);
        return;
      }

      const match = bindingsRef.current.find((b) => {
        const { isChord } = parseKeys(b.keys);
        return !isChord && !b.keys.includes('+') && b.keys === e.key.toLowerCase();
      });
      const questionMatch = bindingsRef.current.find((b) => b.keys === '?' && e.key === '?');

      if (questionMatch) { e.preventDefault(); questionMatch.handler(); }
      else if (match) { e.preventDefault(); match.handler(); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); clearChord(); };
  }, [clearChord]);
}

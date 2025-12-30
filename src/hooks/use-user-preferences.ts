'use client';

import { useState, useEffect, useCallback } from 'react';
import type { UserPreferences } from '@/types';

const STORAGE_KEY = 'user-preferences-cache';

interface UseUserPreferencesReturn {
  preferences: UserPreferences;
  isLoading: boolean;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  isSaving: boolean;
}

function getCachedPreferences(): UserPreferences {
  if (typeof window === 'undefined') return {};
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}

function setCachedPreferences(prefs: UserPreferences) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error('Failed to cache preferences:', e);
  }
}

export function useUserPreferences(): UseUserPreferencesReturn {
  const [preferences, setPreferences] = useState<UserPreferences>(getCachedPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load preferences from API on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const response = await fetch('/api/user/preferences');
        if (response.ok) {
          const data = await response.json();
          const prefs = data.preferences || {};
          setPreferences(prefs);
          setCachedPreferences(prefs);
        }
      } catch (error) {
        console.error('Failed to load preferences:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, []);

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: updates }),
      });

      if (response.ok) {
        const data = await response.json();
        const newPrefs = data.preferences || {};
        setPreferences(newPrefs);
        setCachedPreferences(newPrefs);
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Failed to update preferences:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return {
    preferences,
    isLoading,
    updatePreferences,
    isSaving,
  };
}

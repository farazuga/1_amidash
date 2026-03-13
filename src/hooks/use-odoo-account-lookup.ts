'use client';

import { useState, useEffect } from 'react';
import { useDebounce } from './use-debounce';

interface OdooAccountLookupResult {
  accountName: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useOdooAccountLookup(accountCode: string): OdooAccountLookupResult {
  const [accountName, setAccountName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedCode = useDebounce(accountCode, 500);

  useEffect(() => {
    if (!debouncedCode || debouncedCode.trim().length === 0) {
      setAccountName(null);
      setError(null);
      return;
    }

    const controller = new AbortController();

    const lookup = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/odoo/account-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountCode: debouncedCode.trim() }),
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 404) {
            setError(`Account "${debouncedCode.trim()}" not found`);
            setAccountName(null);
          } else {
            setError(data.error || 'Lookup failed');
            setAccountName(null);
          }
          return;
        }

        setAccountName(data.accountName);
        setError(null);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError('Failed to look up account');
        setAccountName(null);
      } finally {
        setIsLoading(false);
      }
    };

    lookup();

    return () => {
      controller.abort();
    };
  }, [debouncedCode]);

  return { accountName, isLoading, error };
}

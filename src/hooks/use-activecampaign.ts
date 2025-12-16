'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from './use-debounce';
import type { ACAccount, ACContact } from '@/types/activecampaign';

interface UseActiveCampaignSearchResult {
  accounts: ACAccount[];
  isLoading: boolean;
  error: string | null;
}

export function useActiveCampaignSearch(searchTerm: string): UseActiveCampaignSearchResult {
  const [accounts, setAccounts] = useState<ACAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setAccounts([]);
      setError(null);
      return;
    }

    const controller = new AbortController();

    const searchAccounts = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/activecampaign/accounts?search=${encodeURIComponent(debouncedSearch)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();

        if (data.error && !data.accounts?.length) {
          // AC not configured or other non-fatal error
          setAccounts([]);
          return;
        }

        setAccounts(data.accounts || []);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return; // Ignore aborted requests
        }
        setError('Failed to search accounts');
        setAccounts([]);
      } finally {
        setIsLoading(false);
      }
    };

    searchAccounts();

    return () => {
      controller.abort();
    };
  }, [debouncedSearch]);

  return { accounts, isLoading, error };
}

interface UseActiveCampaignContactsResult {
  contacts: ACContact[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useActiveCampaignContacts(accountId: string | null): UseActiveCampaignContactsResult {
  const [contacts, setContacts] = useState<ACContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    if (!accountId) {
      setContacts([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/activecampaign/accounts/${accountId}/contacts`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch contacts');
      }

      const data = await response.json();

      if (data.error && !data.contacts?.length) {
        // AC not configured or other non-fatal error
        setContacts([]);
        return;
      }

      setContacts(data.contacts || []);
    } catch (err) {
      setError('Failed to load contacts');
      setContacts([]);
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  return { contacts, isLoading, error, refetch: fetchContacts };
}

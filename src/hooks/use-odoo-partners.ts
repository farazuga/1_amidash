'use client';

import { useState, useEffect } from 'react';
import { useDebounce } from './use-debounce';

export interface OdooPartnerAddress {
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
}

export interface OdooPartnerResult {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  isCompany: boolean;
  address: OdooPartnerAddress | null;
}

interface UseOdooPartnerSearchResult {
  partners: OdooPartnerResult[];
  isLoading: boolean;
  error: string | null;
}

export function useOdooPartnerSearch(searchTerm: string): UseOdooPartnerSearchResult {
  const [partners, setPartners] = useState<OdooPartnerResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setPartners([]);
      setError(null);
      return;
    }

    const controller = new AbortController();

    const search = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/odoo/partners?q=${encodeURIComponent(debouncedSearch)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();
        setPartners(data.partners || []);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError('Failed to search partners');
        setPartners([]);
      } finally {
        setIsLoading(false);
      }
    };

    search();

    return () => { controller.abort(); };
  }, [debouncedSearch]);

  return { partners, isLoading, error };
}

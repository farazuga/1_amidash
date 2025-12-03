'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, AlertTriangle } from 'lucide-react';
import { CONTRACT_TYPES } from '@/lib/constants';
import type { Status } from '@/types';
import { useCallback, useState, useTransition } from 'react';

interface FilterBarProps {
  statuses: Status[];
}

export function FilterBar({ statuses }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get('search') || '');

  const createQueryString = useCallback(
    (params: Record<string, string | null>) => {
      const newParams = new URLSearchParams(searchParams.toString());

      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === '') {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      });

      return newParams.toString();
    },
    [searchParams]
  );

  const handleSearch = () => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString({ search })}`);
    });
  };

  const handleFilterChange = (key: string, value: string | null) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString({ [key]: value })}`);
    });
  };

  const handleClearFilters = () => {
    setSearch('');
    startTransition(() => {
      router.push(pathname);
    });
  };

  const hasFilters =
    searchParams.has('search') ||
    searchParams.has('status') ||
    searchParams.has('contract_type') ||
    searchParams.has('overdue');

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search clients, PO#, sales order..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={isPending}>
            Search
          </Button>
        </div>

        {/* Status Filter */}
        <Select
          value={searchParams.get('status') || 'all'}
          onValueChange={(value) => handleFilterChange('status', value === 'all' ? null : value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status.id} value={status.id}>
                {status.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Contract Type Filter */}
        <Select
          value={searchParams.get('contract_type') || 'all'}
          onValueChange={(value) =>
            handleFilterChange('contract_type', value === 'all' ? null : value)
          }
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All Contract Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Contract Types</SelectItem>
            {CONTRACT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Overdue Toggle */}
        <Button
          variant={searchParams.get('overdue') === 'true' ? 'destructive' : 'outline'}
          onClick={() =>
            handleFilterChange(
              'overdue',
              searchParams.get('overdue') === 'true' ? null : 'true'
            )
          }
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          Overdue Only
        </Button>

        {/* Clear Filters */}
        {hasFilters && (
          <Button variant="ghost" onClick={handleClearFilters}>
            <X className="mr-2 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

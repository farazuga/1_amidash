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
  currentView: 'active' | 'archived';
}

export function FilterBar({ statuses, currentView }: FilterBarProps) {
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

  const handleViewChange = (view: 'active' | 'archived') => {
    startTransition(() => {
      const newParams = new URLSearchParams(searchParams.toString());
      if (view === 'active') {
        newParams.delete('view');
      } else {
        newParams.set('view', view);
      }
      // Clear status filter when switching views to avoid confusion
      newParams.delete('status');
      router.push(`${pathname}?${newParams.toString()}`);
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-3 md:p-4">
      {/* Active/Archived Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="inline-flex rounded-lg border bg-muted p-1 w-full sm:w-auto">
          <button
            onClick={() => handleViewChange('active')}
            className={`rounded-md px-3 sm:px-4 py-2 text-sm font-medium transition-colors flex-1 sm:flex-none ${
              currentView === 'active'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => handleViewChange('archived')}
            className={`rounded-md px-3 sm:px-4 py-2 text-sm font-medium transition-colors flex-1 sm:flex-none ${
              currentView === 'archived'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Archived
          </button>
        </div>
        <span className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
          {currentView === 'active' ? 'Showing active projects' : 'Showing invoiced/archived projects'}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {/* Search - Full width on mobile */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search clients, PO#, sales order..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={isPending} className="w-full sm:w-auto">
            Search
          </Button>
        </div>

        {/* Filters - Stack on mobile, wrap on larger screens */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
          {/* Status Filter */}
          <Select
            value={searchParams.get('status') || 'all'}
            onValueChange={(value) => handleFilterChange('status', value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
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
            <SelectTrigger className="w-full sm:w-[220px]">
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
            className="w-full sm:w-auto"
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Overdue Only
          </Button>

          {/* Clear Filters */}
          {hasFilters && (
            <Button variant="ghost" onClick={handleClearFilters} className="w-full sm:w-auto">
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

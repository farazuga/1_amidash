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
import { Search, X, AlertTriangle, Calendar } from 'lucide-react';
import { CONTRACT_TYPES } from '@/lib/constants';
import type { Status } from '@/types';
import { useCallback, useState, useTransition, useEffect, useRef } from 'react';

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

// Generate years from 2020 to current year + 1
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 2020 + 2 }, (_, i) => ({
  value: String(2020 + i),
  label: String(2020 + i),
}));

interface FilterBarProps {
  statuses: Status[];
  currentView: 'active' | 'archived';
}

export function FilterBar({ statuses, currentView }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

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

  // Debounced search effect
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const currentSearch = searchParams.get('search') || '';
      if (search !== currentSearch) {
        startTransition(() => {
          router.push(`${pathname}?${createQueryString({ search: search || null })}`);
        });
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [search, searchParams, pathname, router, createQueryString]);

  const handleFilterChange = (key: string, value: string | null) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString({ [key]: value })}`);
    });
  };

  const handleDateFilterChange = (params: Record<string, string | null>) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(params)}`);
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
    searchParams.has('overdue') ||
    searchParams.has('date_type') ||
    searchParams.has('from_month') ||
    searchParams.has('from_year') ||
    searchParams.has('to_month') ||
    searchParams.has('to_year');

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
        {/* Search - Full width, updates as you type */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients, PO#, sales order..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
          {isPending && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
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

        {/* Date Range Filter */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 pt-2 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Date Filter:</span>
          </div>

          {/* Date Type Selector */}
          <Select
            value={searchParams.get('date_type') || 'none'}
            onValueChange={(value) =>
              handleDateFilterChange({ date_type: value === 'none' ? null : value })
            }
          >
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Select date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No filter</SelectItem>
              <SelectItem value="created">Created Date</SelectItem>
              <SelectItem value="goal">Goal Date</SelectItem>
            </SelectContent>
          </Select>

          {searchParams.get('date_type') && (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">From:</span>
              <div className="flex gap-2 w-full sm:w-auto">
                <Select
                  value={searchParams.get('from_month') || 'any'}
                  onValueChange={(value) =>
                    handleFilterChange('from_month', value === 'any' ? null : value)
                  }
                >
                  <SelectTrigger className="w-full sm:w-[120px]">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any month</SelectItem>
                    {MONTHS.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={searchParams.get('from_year') || 'any'}
                  onValueChange={(value) =>
                    handleFilterChange('from_year', value === 'any' ? null : value)
                  }
                >
                  <SelectTrigger className="w-full sm:w-[100px]">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any year</SelectItem>
                    {YEARS.map((year) => (
                      <SelectItem key={year.value} value={year.value}>
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <span className="text-sm text-muted-foreground hidden sm:inline">To:</span>
              <div className="flex gap-2 w-full sm:w-auto">
                <Select
                  value={searchParams.get('to_month') || 'any'}
                  onValueChange={(value) =>
                    handleFilterChange('to_month', value === 'any' ? null : value)
                  }
                >
                  <SelectTrigger className="w-full sm:w-[120px]">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any month</SelectItem>
                    {MONTHS.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={searchParams.get('to_year') || 'any'}
                  onValueChange={(value) =>
                    handleFilterChange('to_year', value === 'any' ? null : value)
                  }
                >
                  <SelectTrigger className="w-full sm:w-[100px]">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any year</SelectItem>
                    {YEARS.map((year) => (
                      <SelectItem key={year.value} value={year.value}>
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import { useCallback, useState, useTransition, useEffect, useRef } from 'react';
import { FilterPopover } from './filter-popover';

interface FilterBarProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statuses: any[];
  currentView: 'active' | 'archived';
}

export function FilterBar({ statuses, currentView }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [search, setSearch] = useState(searchParams.get('search') || '');

  // Parse selected values from URL for display
  const selectedStatuses = searchParams.get('statuses')?.split(',').filter(Boolean) || [];
  const contractType = searchParams.get('contract_type') || '';
  const overdue = searchParams.get('overdue') === 'true';
  const dateType = searchParams.get('date_type') || '';
  const selectedDatePresets = searchParams.get('date_presets')?.split(',').filter(Boolean) || [];
  const selectedYears = searchParams.get('date_years')?.split(',').filter(Boolean) || [];

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

  const handleViewChange = (view: 'active' | 'archived') => {
    startTransition(() => {
      const newParams = new URLSearchParams(searchParams.toString());
      if (view === 'active') {
        newParams.delete('view');
      } else {
        newParams.set('view', view);
      }
      // Clear status filter when switching views to avoid confusion
      newParams.delete('statuses');
      router.push(`${pathname}?${newParams.toString()}`);
    });
  };

  const handleRemoveFilter = (key: string, value?: string) => {
    startTransition(() => {
      const newParams = new URLSearchParams(searchParams.toString());

      if (key === 'statuses' && value) {
        const current = newParams.get('statuses')?.split(',').filter(Boolean) || [];
        const updated = current.filter(id => id !== value);
        if (updated.length > 0) {
          newParams.set('statuses', updated.join(','));
        } else {
          newParams.delete('statuses');
        }
      } else if (key === 'date_presets' && value) {
        const current = newParams.get('date_presets')?.split(',').filter(Boolean) || [];
        const updated = current.filter(p => p !== value);
        if (updated.length > 0) {
          newParams.set('date_presets', updated.join(','));
        } else {
          newParams.delete('date_presets');
        }
      } else if (key === 'date_years' && value) {
        const current = newParams.get('date_years')?.split(',').filter(Boolean) || [];
        const updated = current.filter(y => y !== value);
        if (updated.length > 0) {
          newParams.set('date_years', updated.join(','));
        } else {
          newParams.delete('date_years');
        }
      } else {
        newParams.delete(key);
      }

      router.push(`${pathname}?${newParams.toString()}`);
    });
  };

  const getStatusName = (id: string) => statuses.find(s => s.id === id)?.name || id;

  const getPresetLabel = (value: string) => {
    const labels: Record<string, string> = {
      this_month: 'This Month',
      last_3_months: 'Last 3 Mo',
      q1: 'Q1', q2: 'Q2', q3: 'Q3', q4: 'Q4',
      this_year: 'This Year',
      last_year: 'Last Year',
    };
    return labels[value] || value;
  };

  const hasActiveFilters = selectedStatuses.length > 0 ||
    contractType ||
    overdue ||
    dateType ||
    selectedDatePresets.length > 0 ||
    selectedYears.length > 0;

  return (
    <div className="space-y-3">
      {/* Main filter row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Active/Archived Toggle */}
        <div className="inline-flex rounded-lg border bg-muted p-1 shrink-0">
          <button
            onClick={() => handleViewChange('active')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              currentView === 'active'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => handleViewChange('archived')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              currentView === 'archived'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Archived
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients, PO#, sales order..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-9"
          />
          {isPending && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </div>

        {/* Filter Popover */}
        <FilterPopover statuses={statuses} />
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {/* Status chips */}
          {selectedStatuses.map((statusId) => (
            <Badge
              key={statusId}
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 gap-1"
              onClick={() => handleRemoveFilter('statuses', statusId)}
            >
              {getStatusName(statusId)}
              <X className="h-3 w-3" />
            </Badge>
          ))}

          {/* Contract type chip */}
          {contractType && (
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 gap-1"
              onClick={() => handleRemoveFilter('contract_type')}
            >
              {contractType}
              <X className="h-3 w-3" />
            </Badge>
          )}

          {/* Overdue chip */}
          {overdue && (
            <Badge
              variant="destructive"
              className="cursor-pointer hover:bg-destructive/80 gap-1"
              onClick={() => handleRemoveFilter('overdue')}
            >
              Overdue
              <X className="h-3 w-3" />
            </Badge>
          )}

          {/* Date type chip */}
          {dateType && (
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-muted gap-1"
              onClick={() => handleRemoveFilter('date_type')}
            >
              {dateType === 'created' ? 'Created' : 'Goal'} Date
              <X className="h-3 w-3" />
            </Badge>
          )}

          {/* Date preset chips */}
          {selectedDatePresets.map((preset) => (
            <Badge
              key={preset}
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 gap-1"
              onClick={() => handleRemoveFilter('date_presets', preset)}
            >
              {getPresetLabel(preset)}
              <X className="h-3 w-3" />
            </Badge>
          ))}

          {/* Year chips */}
          {selectedYears.map((year) => (
            <Badge
              key={year}
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 gap-1"
              onClick={() => handleRemoveFilter('date_years', year)}
            >
              {year}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

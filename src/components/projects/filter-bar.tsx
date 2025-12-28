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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, X, AlertTriangle, Calendar, ChevronDown } from 'lucide-react';
import { CONTRACT_TYPES } from '@/lib/constants';
import { useCallback, useState, useTransition, useEffect, useRef } from 'react';

// Date preset options
const DATE_PRESETS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'q1', label: 'Q1 (Jan-Mar)' },
  { value: 'q2', label: 'Q2 (Apr-Jun)' },
  { value: 'q3', label: 'Q3 (Jul-Sep)' },
  { value: 'q4', label: 'Q4 (Oct-Dec)' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
];

// Years: 2025, 2026, 2027
const YEARS = ['2025', '2026', '2027'];

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
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const [search, setSearch] = useState(searchParams.get('search') || '');

  // Parse selected statuses from URL (comma-separated)
  const selectedStatuses = searchParams.get('statuses')?.split(',').filter(Boolean) || [];

  // Parse selected date presets from URL (comma-separated)
  const selectedDatePresets = searchParams.get('date_presets')?.split(',').filter(Boolean) || [];

  // Parse selected years from URL (comma-separated)
  const selectedYears = searchParams.get('date_years')?.split(',').filter(Boolean) || [];

  // Get date type (created or goal)
  const dateType = searchParams.get('date_type') || '';

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

  const handleMultiFilterChange = (params: Record<string, string | null>) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(params)}`);
    });
  };

  const handleStatusToggle = (statusId: string) => {
    const newStatuses = selectedStatuses.includes(statusId)
      ? selectedStatuses.filter(id => id !== statusId)
      : [...selectedStatuses, statusId];

    handleFilterChange('statuses', newStatuses.length > 0 ? newStatuses.join(',') : null);
  };

  const handleRemoveStatus = (statusId: string) => {
    const newStatuses = selectedStatuses.filter(id => id !== statusId);
    handleFilterChange('statuses', newStatuses.length > 0 ? newStatuses.join(',') : null);
  };

  const handleDatePresetToggle = (preset: string) => {
    const newPresets = selectedDatePresets.includes(preset)
      ? selectedDatePresets.filter(p => p !== preset)
      : [...selectedDatePresets, preset];

    handleFilterChange('date_presets', newPresets.length > 0 ? newPresets.join(',') : null);
  };

  const handleYearToggle = (year: string) => {
    const newYears = selectedYears.includes(year)
      ? selectedYears.filter(y => y !== year)
      : [...selectedYears, year];

    handleFilterChange('date_years', newYears.length > 0 ? newYears.join(',') : null);
  };

  const handleClearFilters = () => {
    setSearch('');
    startTransition(() => {
      router.push(pathname);
    });
  };

  const clearDateFilters = () => {
    handleMultiFilterChange({
      date_type: null,
      date_presets: null,
      date_years: null,
    });
  };

  const hasFilters =
    searchParams.has('search') ||
    searchParams.has('statuses') ||
    searchParams.has('contract_type') ||
    searchParams.has('overdue') ||
    searchParams.has('date_type') ||
    searchParams.has('date_presets') ||
    searchParams.has('date_years');

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

  const getStatusName = (id: string) => {
    return statuses.find(s => s.id === id)?.name || id;
  };

  const getPresetLabel = (value: string) => {
    return DATE_PRESETS.find(p => p.value === value)?.label || value;
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
          {/* Multi-Select Status Filter */}
          <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-[180px] justify-between">
                {selectedStatuses.length > 0
                  ? `${selectedStatuses.length} status${selectedStatuses.length > 1 ? 'es' : ''}`
                  : 'All Statuses'}
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-2" align="start">
              <div className="space-y-2">
                {statuses.map((status) => (
                  <div key={status.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${status.id}`}
                      checked={selectedStatuses.includes(status.id)}
                      onCheckedChange={() => handleStatusToggle(status.id)}
                    />
                    <label
                      htmlFor={`status-${status.id}`}
                      className="text-sm font-medium leading-none cursor-pointer flex-1"
                    >
                      {status.name}
                    </label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

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

        {/* Selected Status Chips */}
        {selectedStatuses.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedStatuses.map((statusId) => (
              <Badge
                key={statusId}
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80"
                onClick={() => handleRemoveStatus(statusId)}
              >
                {getStatusName(statusId)}
                <X className="ml-1 h-3 w-3" />
              </Badge>
            ))}
          </div>
        )}

        {/* Date Filter Section */}
        <div className="flex flex-col gap-2 pt-2 border-t">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Date Filter:</span>
            </div>

            {/* Date Type Selector */}
            <Select
              value={dateType || 'none'}
              onValueChange={(value) =>
                handleFilterChange('date_type', value === 'none' ? null : value)
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

            {dateType && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearDateFilters}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Date Presets and Years - Only show when date type is selected */}
          {dateType && (
            <div className="flex flex-col gap-3">
              {/* Quick Presets */}
              <div className="flex flex-wrap gap-2">
                {DATE_PRESETS.map((preset) => (
                  <Button
                    key={preset.value}
                    variant={selectedDatePresets.includes(preset.value) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleDatePresetToggle(preset.value)}
                    className="h-8"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              {/* Year Selection */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Year:</span>
                <div className="flex gap-2">
                  {YEARS.map((year) => (
                    <Button
                      key={year}
                      variant={selectedYears.includes(year) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleYearToggle(year)}
                      className="h-8"
                    >
                      {year}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Selected Date Filters Display */}
              {(selectedDatePresets.length > 0 || selectedYears.length > 0) && (
                <div className="flex flex-wrap gap-2">
                  {selectedDatePresets.map((preset) => (
                    <Badge
                      key={preset}
                      variant="secondary"
                      className="cursor-pointer hover:bg-secondary/80"
                      onClick={() => handleDatePresetToggle(preset)}
                    >
                      {getPresetLabel(preset)}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
                  {selectedYears.map((year) => (
                    <Badge
                      key={year}
                      variant="secondary"
                      className="cursor-pointer hover:bg-secondary/80"
                      onClick={() => handleYearToggle(year)}
                    >
                      {year}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

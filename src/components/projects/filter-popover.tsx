'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Filter, X, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { CONTRACT_TYPES } from '@/lib/constants';
import { useState, useTransition, useCallback, useEffect, useRef } from 'react';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { toast } from 'sonner';

// Date preset options
const DATE_PRESETS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'q1', label: 'Q1' },
  { value: 'q2', label: 'Q2' },
  { value: 'q3', label: 'Q3' },
  { value: 'q4', label: 'Q4' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
];

const YEARS = ['2025', '2026', '2027'];

interface FilterPopoverProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statuses: any[];
}

export function FilterPopover({ statuses }: FilterPopoverProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const { preferences: userPrefs, updatePreferences, isSaving } = useUserPreferences();
  const hasLoadedDefaults = useRef(false);

  // Parse current filter values from URL
  const selectedStatuses = searchParams.get('statuses')?.split(',').filter(Boolean) || [];
  const contractType = searchParams.get('contract_type') || '';
  const overdue = searchParams.get('overdue') === 'true';
  const dateType = searchParams.get('date_type') || '';
  const selectedDatePresets = searchParams.get('date_presets')?.split(',').filter(Boolean) || [];
  const selectedYears = searchParams.get('date_years')?.split(',').filter(Boolean) || [];

  // Apply default filters from user preferences on mount (only once, when no filters are set)
  useEffect(() => {
    if (userPrefs?.projects_filter && !hasLoadedDefaults.current) {
      const currentSearch = searchParams.toString();
      // Only apply defaults if no filters are currently set (except view)
      const hasFilters = searchParams.has('statuses') ||
        searchParams.has('contract_type') ||
        searchParams.has('overdue') ||
        searchParams.has('date_type');

      if (!hasFilters) {
        hasLoadedDefaults.current = true;
        const filter = userPrefs.projects_filter;
        const params = new URLSearchParams(searchParams.toString());

        if (filter.statuses?.length) params.set('statuses', filter.statuses.join(','));
        if (filter.contract_type) params.set('contract_type', filter.contract_type);
        if (filter.overdue) params.set('overdue', 'true');
        if (filter.date_type) params.set('date_type', filter.date_type);
        if (filter.date_presets?.length) params.set('date_presets', filter.date_presets.join(','));
        if (filter.date_years?.length) params.set('date_years', filter.date_years.join(','));

        const newSearch = params.toString();
        if (newSearch !== currentSearch) {
          router.push(`${pathname}?${newSearch}`);
        }
      }
    }
  }, [userPrefs, searchParams, pathname, router]);

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

  const handleFilterChange = (params: Record<string, string | null>) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(params)}`);
    });
  };

  const handleStatusToggle = (statusId: string) => {
    const newStatuses = selectedStatuses.includes(statusId)
      ? selectedStatuses.filter(id => id !== statusId)
      : [...selectedStatuses, statusId];
    handleFilterChange({ statuses: newStatuses.length > 0 ? newStatuses.join(',') : null });
  };

  const handleDatePresetToggle = (preset: string) => {
    const newPresets = selectedDatePresets.includes(preset)
      ? selectedDatePresets.filter(p => p !== preset)
      : [...selectedDatePresets, preset];
    handleFilterChange({ date_presets: newPresets.length > 0 ? newPresets.join(',') : null });
  };

  const handleYearToggle = (year: string) => {
    const newYears = selectedYears.includes(year)
      ? selectedYears.filter(y => y !== year)
      : [...selectedYears, year];
    handleFilterChange({ date_years: newYears.length > 0 ? newYears.join(',') : null });
  };

  const clearAllFilters = () => {
    handleFilterChange({
      statuses: null,
      contract_type: null,
      overdue: null,
      date_type: null,
      date_presets: null,
      date_years: null,
    });
  };

  const saveAsDefault = async () => {
    try {
      await updatePreferences({
        projects_filter: {
          statuses: selectedStatuses,
          contract_type: contractType || undefined,
          overdue: overdue || undefined,
          date_type: dateType as 'created' | 'goal' | undefined,
          date_presets: selectedDatePresets,
          date_years: selectedYears,
        },
      });
      toast.success('Filter saved as default');
    } catch {
      toast.error('Failed to save default filter');
    }
  };

  // Count active filters
  const activeFilterCount = [
    selectedStatuses.length > 0,
    !!contractType,
    overdue,
    !!dateType,
  ].filter(Boolean).length;

  const getStatusName = (id: string) => statuses.find(s => s.id === id)?.name || id;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
              {activeFilterCount}
            </Badge>
          )}
          {isPending && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filters</h4>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 px-2 text-xs">
                <X className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto">
              {statuses.map((status) => (
                <div key={status.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`filter-status-${status.id}`}
                    checked={selectedStatuses.includes(status.id)}
                    onCheckedChange={() => handleStatusToggle(status.id)}
                  />
                  <label
                    htmlFor={`filter-status-${status.id}`}
                    className="text-xs cursor-pointer truncate"
                  >
                    {status.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Contract Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Contract Type</label>
            <Select
              value={contractType || 'all'}
              onValueChange={(value) =>
                handleFilterChange({ contract_type: value === 'all' ? null : value })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {CONTRACT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Overdue Toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="filter-overdue"
              checked={overdue}
              onCheckedChange={(checked) =>
                handleFilterChange({ overdue: checked ? 'true' : null })
              }
            />
            <label htmlFor="filter-overdue" className="text-sm cursor-pointer flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-destructive" />
              Overdue only
            </label>
          </div>

          {/* Date Filter Section */}
          <div className="space-y-2 border-t pt-3">
            <label className="text-sm font-medium">Date Filter</label>
            <Select
              value={dateType || 'none'}
              onValueChange={(value) =>
                handleFilterChange({
                  date_type: value === 'none' ? null : value,
                  date_presets: value === 'none' ? null : searchParams.get('date_presets'),
                  date_years: value === 'none' ? null : searchParams.get('date_years'),
                })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="No filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No filter</SelectItem>
                <SelectItem value="created">Created Date</SelectItem>
                <SelectItem value="goal">Goal Date</SelectItem>
              </SelectContent>
            </Select>

            {dateType && (
              <div className="space-y-2">
                {/* Date Presets */}
                <div className="flex flex-wrap gap-1">
                  {DATE_PRESETS.map((preset) => (
                    <Button
                      key={preset.value}
                      variant={selectedDatePresets.includes(preset.value) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleDatePresetToggle(preset.value)}
                      className="h-6 text-xs px-2"
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>

                {/* Year Selection */}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Year:</span>
                  {YEARS.map((year) => (
                    <Button
                      key={year}
                      variant={selectedYears.includes(year) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleYearToggle(year)}
                      className="h-6 text-xs px-2"
                    >
                      {year}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Save as Default */}
          <div className="border-t pt-3">
            <Button
              onClick={saveAsDefault}
              disabled={isSaving}
              size="sm"
              variant="secondary"
              className="w-full"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save as Default
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

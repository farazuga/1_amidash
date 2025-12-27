'use client';

import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { DateRange } from 'react-day-picker';

interface ProjectDatePickerProps {
  startDate: string | null;
  endDate: string | null;
  onDateChange: (startDate: string | null, endDate: string | null) => void;
  disabled?: boolean;
  error?: string;
}

export function ProjectDatePicker({
  startDate,
  endDate,
  onDateChange,
  disabled = false,
  error,
}: ProjectDatePickerProps) {
  const [open, setOpen] = useState(false);

  const dateRange: DateRange | undefined =
    startDate && endDate
      ? {
          from: parseISO(startDate),
          to: parseISO(endDate),
        }
      : startDate
      ? {
          from: parseISO(startDate),
          to: undefined,
        }
      : undefined;

  const handleSelect = (range: DateRange | undefined) => {
    if (!range) {
      onDateChange(null, null);
      return;
    }

    const newStartDate = range.from ? format(range.from, 'yyyy-MM-dd') : null;
    const newEndDate = range.to ? format(range.to, 'yyyy-MM-dd') : null;

    onDateChange(newStartDate, newEndDate);
  };

  const formatDateRange = () => {
    if (!startDate && !endDate) {
      return 'Select project dates';
    }

    if (startDate && !endDate) {
      return `${format(parseISO(startDate), 'MMM d, yyyy')} - Select end date`;
    }

    if (startDate && endDate) {
      return `${format(parseISO(startDate), 'MMM d, yyyy')} - ${format(
        parseISO(endDate),
        'MMM d, yyyy'
      )}`;
    }

    return 'Select project dates';
  };

  return (
    <div className="space-y-2">
      <Label>Project Dates</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !startDate && !endDate && 'text-muted-foreground',
              error && 'border-destructive'
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDateRange()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={handleSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Select the start and end dates for this project schedule
      </p>
    </div>
  );
}

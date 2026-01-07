'use client';

import { useState, useRef } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Pencil, Loader2, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { DateRange } from 'react-day-picker';

interface InlineDateRangePickerProps {
  startDate: string | null;
  endDate: string | null;
  onSave: (startDate: string | null, endDate: string | null) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function InlineDateRangePicker({
  startDate,
  endDate,
  onSave,
  disabled = false,
  className,
}: InlineDateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(undefined);

  // Ref to track mid-selection state synchronously (avoids race condition with popover close)
  const isMidSelectionRef = useRef(false);

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

  const handleSelect = async (range: DateRange | undefined) => {
    // Update ref synchronously BEFORE state to prevent race condition with popover close
    isMidSelectionRef.current = Boolean(range?.from && !range?.to);
    setPendingRange(range);

    // Auto-save when both dates are selected
    if (range?.from && range?.to) {
      isMidSelectionRef.current = false;
      setIsSaving(true);
      try {
        const newStartDate = format(range.from, 'yyyy-MM-dd');
        const newEndDate = format(range.to, 'yyyy-MM-dd');
        await onSave(newStartDate, newEndDate);
        setOpen(false);
      } catch (error) {
        console.error('Failed to save dates:', error);
      } finally {
        setIsSaving(false);
        setPendingRange(undefined);
      }
    }
  };

  const handleClear = async () => {
    isMidSelectionRef.current = false;
    setIsSaving(true);
    try {
      await onSave(null, null);
      setPendingRange(undefined);
      setOpen(false);
    } catch (error) {
      console.error('Failed to clear dates:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDateRange = () => {
    if (!startDate && !endDate) {
      return <span className="text-muted-foreground italic">Not set</span>;
    }

    if (startDate && endDate) {
      return (
        <span className="font-medium">
          {format(parseISO(startDate), 'MMM d')} — {format(parseISO(endDate), 'MMM d, yyyy')}
        </span>
      );
    }

    if (startDate) {
      return (
        <span className="font-medium">
          Starts {format(parseISO(startDate), 'MMM d, yyyy')}
        </span>
      );
    }

    return <span className="text-muted-foreground italic">Not set</span>;
  };

  if (disabled) {
    return <div className={className}>{formatDateRange()}</div>;
  }

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      // Prevent closing if we're mid-selection (use ref for synchronous check)
      if (!isOpen && isMidSelectionRef.current) {
        return;
      }
      // Reset ref when closing
      if (!isOpen) {
        isMidSelectionRef.current = false;
      }
      setOpen(isOpen);
    }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'group flex items-center gap-2 cursor-pointer hover:bg-primary/5 rounded px-1 -mx-1 transition-colors text-left',
            className
          )}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              {formatDateRange()}
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="end"
        onInteractOutside={(e) => {
          // Prevent closing if we're mid-selection
          if (isMidSelectionRef.current) {
            e.preventDefault();
          }
        }}
        onPointerDownOutside={(e) => {
          // Prevent closing if we're mid-selection
          if (isMidSelectionRef.current) {
            e.preventDefault();
          }
        }}
        onFocusOutside={(e) => {
          // Prevent closing if we're mid-selection
          if (isMidSelectionRef.current) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          // Allow escape to cancel mid-selection, but reset the ref
          if (isMidSelectionRef.current) {
            isMidSelectionRef.current = false;
            setPendingRange(undefined);
          }
        }}
      >
        <div className="p-3 border-b flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Select Date Range</p>
            <p className="text-xs text-muted-foreground">
              {pendingRange?.from && !pendingRange?.to
                ? 'Now select end date'
                : 'Click start date, then end date'}
            </p>
          </div>
          {(startDate || endDate || pendingRange?.from) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground hover:text-destructive"
              onClick={handleClear}
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
        <Calendar
          mode="range"
          defaultMonth={dateRange?.from || pendingRange?.from}
          selected={pendingRange || dateRange}
          onSelect={handleSelect}
          numberOfMonths={2}
        />
        {pendingRange?.from && !pendingRange?.to && (
          <div className="p-3 border-t bg-muted/50">
            <p className="text-sm text-muted-foreground">
              Start: {format(pendingRange.from, 'MMM d, yyyy')} — Now select end date
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

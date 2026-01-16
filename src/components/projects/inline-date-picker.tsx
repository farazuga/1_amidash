'use client';

import { useState } from 'react';
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

interface InlineDatePickerProps {
  value: string | null;
  onSave: (date: string | null) => Promise<void>;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  label?: string;
}

export function InlineDatePicker({
  value,
  onSave,
  disabled = false,
  className,
  placeholder = 'Not set',
  label = 'Select Date',
}: InlineDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectedDate = value ? parseISO(value) : undefined;

  const handleSelect = async (date: Date | undefined) => {
    if (!date) return;

    setIsSaving(true);
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      await onSave(formattedDate);
      setOpen(false);
    } catch (error) {
      console.error('Failed to save date:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    try {
      await onSave(null);
      setOpen(false);
    } catch (error) {
      console.error('Failed to clear date:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = () => {
    if (!value) {
      return <span className="text-muted-foreground italic">{placeholder}</span>;
    }
    return (
      <span className="font-medium">
        {format(parseISO(value), 'MMM d, yyyy')}
      </span>
    );
  };

  if (disabled) {
    return <div className={className}>{formatDate()}</div>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
              {formatDate()}
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="p-3 border-b flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">
              Click a date to select
            </p>
          </div>
          {value && (
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
          mode="single"
          defaultMonth={selectedDate}
          selected={selectedDate}
          onSelect={handleSelect}
          numberOfMonths={1}
        />
      </PopoverContent>
    </Popover>
  );
}

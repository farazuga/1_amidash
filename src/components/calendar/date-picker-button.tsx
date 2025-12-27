'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DatePickerButtonProps {
  value: string | null | undefined;
  onChange: (date: string | null) => void;
  label?: string;
  placeholder?: string;
  isLoading?: boolean;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

export function DatePickerButton({
  value,
  onChange,
  label,
  placeholder = 'Select date',
  isLoading = false,
  disabled = false,
  minDate,
  maxDate,
  className,
}: DatePickerButtonProps) {
  const [open, setOpen] = useState(false);

  const selectedDate = value ? parseISO(value) : undefined;

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      // Format as YYYY-MM-DD for the database
      onChange(format(date, 'yyyy-MM-dd'));
    } else {
      onChange(null);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isLoading}
          className={cn(
            'justify-start text-left font-normal h-8',
            !value && 'text-muted-foreground',
            className
          )}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <CalendarIcon className="mr-2 h-3 w-3" />
          )}
          {label && <span className="text-xs text-muted-foreground mr-1">{label}:</span>}
          {value ? (
            <span className="font-medium">
              {format(selectedDate!, 'MMM d, yyyy')}
            </span>
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={(date) => {
            if (minDate && date < minDate) return true;
            if (maxDate && date > maxDate) return true;
            return false;
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

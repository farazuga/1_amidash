'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { BOOKING_STATUS_CONFIG, BOOKING_STATUS_ORDER } from '@/lib/calendar/constants';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScheduleStatusBadge } from './schedule-status-badge';
import type { BookingStatus } from '@/types/calendar';

interface ScheduleStatusSelectProps {
  value: BookingStatus | null;
  onChange: (status: BookingStatus) => void;
  disabled?: boolean;
  hasProjectDates?: boolean;
  className?: string;
}

/**
 * Dropdown select for changing project schedule status
 */
export function ScheduleStatusSelect({
  value,
  onChange,
  disabled = false,
  hasProjectDates = true,
  className,
}: ScheduleStatusSelectProps) {
  if (!hasProjectDates) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        Set project dates to enable schedule status
      </div>
    );
  }

  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => onChange(v as BookingStatus)}
      disabled={disabled}
    >
      <SelectTrigger className={cn('w-[180px]', className)}>
        <SelectValue placeholder="Select status">
          {value ? (
            <ScheduleStatusBadge status={value} size="sm" />
          ) : (
            <span className="text-muted-foreground">Select status</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {BOOKING_STATUS_ORDER.map((status) => {
          const config = BOOKING_STATUS_CONFIG[status];
          return (
            <SelectItem key={status} value={status}>
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', config.dotColor)} />
                <span>{config.label}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/**
 * Inline clickable status badge that cycles through statuses
 */
export function ScheduleStatusCycler({
  value,
  onChange,
  disabled = false,
  hasProjectDates = true,
  className,
}: ScheduleStatusSelectProps) {
  if (!hasProjectDates || !value) {
    return <ScheduleStatusBadge status={null} className={className} />;
  }

  const handleClick = () => {
    if (disabled) return;

    const currentIndex = BOOKING_STATUS_ORDER.indexOf(value);
    const nextIndex = (currentIndex + 1) % BOOKING_STATUS_ORDER.length;
    onChange(BOOKING_STATUS_ORDER[nextIndex]);
  };

  return (
    <ScheduleStatusBadge
      status={value}
      onClick={disabled ? undefined : handleClick}
      className={cn(
        !disabled && 'cursor-pointer hover:opacity-80',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    />
  );
}

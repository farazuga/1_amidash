'use client';

import { ChevronLeft, ChevronRight, ExternalLink, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { DatePickerButton } from './date-picker-button';
import { useUpdateProjectDates } from '@/hooks/queries/use-assignments';
import { toast } from 'sonner';

interface CalendarHeaderWithDatesProps {
  currentDate: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  projectId: string;
  projectName: string;
  projectStartDate: string | null | undefined;
  projectEndDate: string | null | undefined;
  salesOrderUrl?: string | null;
  salesOrderNumber?: string | null;
  isAdmin?: boolean;
  isMobile?: boolean;
}

export function CalendarHeaderWithDates({
  currentDate,
  onPreviousMonth,
  onNextMonth,
  onToday,
  projectId,
  projectName,
  projectStartDate,
  projectEndDate,
  salesOrderUrl,
  salesOrderNumber,
  isAdmin = false,
  isMobile = false,
}: CalendarHeaderWithDatesProps) {
  const updateDates = useUpdateProjectDates();

  const handleStartDateChange = async (date: string | null) => {
    try {
      await updateDates.mutateAsync({
        projectId,
        startDate: date,
        endDate: projectEndDate || null,
      });
      toast.success('Start date updated');
    } catch (error) {
      toast.error('Failed to update start date', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  };

  const handleEndDateChange = async (date: string | null) => {
    try {
      await updateDates.mutateAsync({
        projectId,
        startDate: projectStartDate || null,
        endDate: date,
      });
      toast.success('End date updated');
    } catch (error) {
      toast.error('Failed to update end date', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  };

  // Format date for display on mobile (read-only)
  const formatDateDisplay = (date: string | null | undefined) => {
    if (!date) return 'Not set';
    return format(new Date(date + 'T00:00:00'), 'MMM d, yyyy');
  };

  return (
    <div className="space-y-3">
      {/* Project info row */}
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">{projectName}</h2>
        {salesOrderUrl && (
          <a
            href={salesOrderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            title={salesOrderNumber ? `Sales Order: ${salesOrderNumber}` : 'View Sales Order'}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {salesOrderNumber && <span className="hidden sm:inline">{salesOrderNumber}</span>}
          </a>
        )}
      </div>

      {/* Date navigation and project dates row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={onPreviousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={onNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="text-base font-medium min-w-[140px]">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={onToday}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 print:hidden"
            onClick={() => window.print()}
            title="Print calendar"
          >
            <Printer className="h-4 w-4" />
          </Button>
        </div>

        {/* Project date range - divider on larger screens */}
        <div className="hidden sm:block h-6 w-px bg-border" />

        {/* Project dates */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Project:</span>
          {isMobile || !isAdmin ? (
            // Read-only display on mobile or for non-admins
            <span className="text-sm font-medium">
              {formatDateDisplay(projectStartDate)} - {formatDateDisplay(projectEndDate)}
            </span>
          ) : (
            // Inline date pickers for admins on desktop
            <>
              <DatePickerButton
                value={projectStartDate}
                onChange={handleStartDateChange}
                label="Start"
                placeholder="Start date"
                isLoading={updateDates.isPending}
                maxDate={projectEndDate ? new Date(projectEndDate + 'T00:00:00') : undefined}
              />
              <span className="text-muted-foreground">-</span>
              <DatePickerButton
                value={projectEndDate}
                onChange={handleEndDateChange}
                label="End"
                placeholder="End date"
                isLoading={updateDates.isPending}
                minDate={projectStartDate ? new Date(projectStartDate + 'T00:00:00') : undefined}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { X, ChevronDown, CalendarOff, CheckCircle, PencilLine, Clock } from 'lucide-react';
import { format } from 'date-fns';
import type { BookingStatus } from '@/types/calendar';

interface BulkActionsToolbarProps {
  selectedDates: Date[];
  onClearSelection: () => void;
  onExcludeDates?: (dates: Date[], reason?: string) => void;
  onBulkStatusChange?: (dates: Date[], status: BookingStatus) => void;
  isLoading?: boolean;
  mode?: 'dates' | 'assignments';
}

export function BulkActionsToolbar({
  selectedDates,
  onClearSelection,
  onExcludeDates,
  onBulkStatusChange,
  isLoading,
  mode = 'dates',
}: BulkActionsToolbarProps) {
  const [showExcludeDialog, setShowExcludeDialog] = useState(false);
  const [excludeReason, setExcludeReason] = useState('');

  if (selectedDates.length === 0) return null;

  const handleExclude = () => {
    onExcludeDates?.(selectedDates, excludeReason || undefined);
    setShowExcludeDialog(false);
    setExcludeReason('');
    onClearSelection();
  };

  const handleStatusChange = (status: BookingStatus) => {
    onBulkStatusChange?.(selectedDates, status);
    onClearSelection();
  };

  // Sort dates for display
  const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
  const firstDate = sortedDates[0];
  const lastDate = sortedDates[sortedDates.length - 1];

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-background border rounded-lg shadow-lg px-4 py-2">
        <Badge variant="secondary" className="font-normal">
          {selectedDates.length} date{selectedDates.length !== 1 ? 's' : ''} selected
        </Badge>

        <span className="text-sm text-muted-foreground">
          {selectedDates.length === 1
            ? format(firstDate, 'MMM d, yyyy')
            : `${format(firstDate, 'MMM d')} - ${format(lastDate, 'MMM d, yyyy')}`}
        </span>

        <div className="h-4 w-px bg-border mx-2" />

        {mode === 'dates' && onExcludeDates && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExcludeDialog(true)}
            disabled={isLoading}
          >
            <CalendarOff className="mr-2 h-4 w-4" />
            Exclude Dates
          </Button>
        )}

        {mode === 'assignments' && onBulkStatusChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isLoading}>
                Update Status
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleStatusChange('draft')}>
                <PencilLine className="mr-2 h-4 w-4 text-gray-500" />
                Draft
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('tentative')}>
                <PencilLine className="mr-2 h-4 w-4 text-amber-500" />
                Tentative
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('confirmed')}>
                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                Confirmed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('complete')}>
                <CheckCircle className="mr-2 h-4 w-4 text-purple-500" />
                Complete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Exclude Dates Dialog */}
      <AlertDialog open={showExcludeDialog} onOpenChange={setShowExcludeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exclude Selected Dates</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the selected {selectedDates.length} date{selectedDates.length !== 1 ? 's' : ''} as excluded from the assignment.
              The team member won&apos;t be scheduled for these days.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <label className="text-sm font-medium">
              Reason (optional)
            </label>
            <Textarea
              placeholder="e.g., Holiday, PTO, Training day..."
              value={excludeReason}
              onChange={(e) => setExcludeReason(e.target.value)}
              className="mt-2"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExclude}>
              Exclude {selectedDates.length} Date{selectedDates.length !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

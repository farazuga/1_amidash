'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUnresolvedConflicts } from '@/hooks/queries/use-assignments';
import { ConflictWarningDialog } from './conflict-warning-dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { BookingConflict } from '@/types/calendar';

export function ConflictsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<BookingConflict | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);

  const { data: conflicts = [], isLoading } = useUnresolvedConflicts();

  const handleResolveClick = (conflict: BookingConflict) => {
    setSelectedConflict(conflict);
    setResolveDialogOpen(true);
  };

  const conflictCount = conflicts.length;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="relative"
          >
            <AlertTriangle className="h-4 w-4 mr-1.5" />
            Conflicts
            {conflictCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-2 -right-2 h-5 min-w-[20px] px-1 text-xs"
              >
                {conflictCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Booking Conflicts
            </SheetTitle>
            <SheetDescription>
              {conflictCount === 0
                ? 'No unresolved conflicts'
                : `${conflictCount} unresolved conflict${conflictCount !== 1 ? 's' : ''} require attention`}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : conflicts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No booking conflicts to resolve</p>
              </div>
            ) : (
              conflicts.map((conflict) => (
                <ConflictCard
                  key={conflict.id}
                  conflict={conflict}
                  onResolve={() => handleResolveClick(conflict)}
                />
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ConflictWarningDialog
        open={resolveDialogOpen}
        onOpenChange={setResolveDialogOpen}
        conflict={selectedConflict}
        onSuccess={() => {
          setResolveDialogOpen(false);
          setSelectedConflict(null);
        }}
      />
    </>
  );
}

interface ConflictCardProps {
  conflict: BookingConflict;
  onResolve: () => void;
}

function ConflictCard({ conflict, onResolve }: ConflictCardProps) {
  const conflictDate = format(parseISO(conflict.conflict_date), 'MMM d, yyyy');
  const userName = conflict.user?.full_name || conflict.user?.email || 'Unknown User';
  const project1 = conflict.assignment1?.project?.client_name || 'Unknown Project';
  const project2 = conflict.assignment2?.project?.client_name || 'Unknown Project';

  return (
    <div className="border rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-sm">{userName}</p>
          <p className="text-xs text-muted-foreground">{conflictDate}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onResolve}>
          Resolve
        </Button>
      </div>

      <div className="text-sm space-y-1">
        <p className="text-muted-foreground">Double-booked on:</p>
        <ul className="space-y-1 ml-4">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {project1}
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {project2}
          </li>
        </ul>
      </div>
    </div>
  );
}

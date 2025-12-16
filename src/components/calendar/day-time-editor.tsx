'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useUpdateAssignmentDay } from '@/hooks/queries/use-assignments';
import type { AssignmentDay } from '@/types/calendar';
import { toast } from 'sonner';

interface DayTimeEditorProps {
  day: AssignmentDay;
  trigger?: React.ReactNode;
}

export function DayTimeEditor({ day, trigger }: DayTimeEditorProps) {
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState(day.start_time.slice(0, 5)); // HH:MM format
  const [endTime, setEndTime] = useState(day.end_time.slice(0, 5)); // HH:MM format

  const updateDay = useUpdateAssignmentDay();

  const handleSave = async () => {
    // Validate times
    if (endTime <= startTime) {
      toast.error('Invalid times', {
        description: 'End time must be after start time',
      });
      return;
    }

    try {
      await updateDay.mutateAsync({
        dayId: day.id,
        startTime: `${startTime}:00`,
        endTime: `${endTime}:00`,
      });

      toast.success('Times updated');
      setOpen(false);
    } catch (error) {
      toast.error('Failed to update times', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  };

  const formattedDate = format(
    new Date(day.work_date + 'T00:00:00'),
    'EEEE, MMMM d, yyyy'
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-7 gap-1">
            <Clock className="h-3 w-3" />
            {startTime} - {endTime}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium">Edit Times</h4>
            <p className="text-sm text-muted-foreground">{formattedDate}</p>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateDay.isPending}
            >
              {updateDay.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

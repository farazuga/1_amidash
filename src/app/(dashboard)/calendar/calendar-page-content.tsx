'use client';

import { useState } from 'react';
import { ProjectCalendar } from '@/components/calendar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link2, ExternalLink } from 'lucide-react';
import { useCalendarSubscriptions, useCreateCalendarSubscription } from '@/hooks/queries/use-assignments';
import { toast } from 'sonner';
import type { CalendarEvent } from '@/types/calendar';
import { useRouter } from 'next/navigation';

interface CalendarPageContentProps {
  isAdmin: boolean;
}

export function CalendarPageContent({ isAdmin }: CalendarPageContentProps) {
  const router = useRouter();
  const [selectedProject, setSelectedProject] = useState<string>('all');

  const { data: subscriptions } = useCalendarSubscriptions();
  const createSubscription = useCreateCalendarSubscription();

  const handleEventClick = (event: CalendarEvent) => {
    router.push(`/projects/${event.salesOrderNumber || event.projectId}`);
  };

  const handleGetICalLink = async () => {
    try {
      const result = await createSubscription.mutateAsync({
        feedType: 'master',
      });

      // Copy to clipboard
      await navigator.clipboard.writeText(result.url);
      toast.success('Calendar link copied to clipboard!', {
        description: 'Paste this URL in your calendar app to subscribe',
      });
    } catch (error) {
      toast.error('Failed to generate calendar link');
    }
  };

  const existingMasterSub = subscriptions?.find(s => s.feed_type === 'master');

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Future: Project filter dropdown */}
        </div>

        <div className="flex items-center gap-2">
          {existingMasterSub ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
                const url = `${baseUrl}/api/calendar/ical/${existingMasterSub.token}`;
                await navigator.clipboard.writeText(url);
                toast.success('Calendar link copied!');
              }}
            >
              <Link2 className="mr-2 h-4 w-4" />
              Copy iCal Link
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGetICalLink}
              disabled={createSubscription.isPending}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Get Calendar Link
            </Button>
          )}
        </div>
      </div>

      {/* Calendar */}
      <ProjectCalendar onEventClick={handleEventClick} />

      {/* Help text */}
      <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
        <p className="font-medium mb-2">Calendar Subscription</p>
        <p>
          Click &quot;Get Calendar Link&quot; to get a URL you can add to Office 365, Google Calendar,
          or Apple Calendar. The calendar will automatically stay in sync with project schedules.
        </p>
      </div>
    </div>
  );
}

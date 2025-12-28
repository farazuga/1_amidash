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
import { Link2, ExternalLink, Users, ListTodo } from 'lucide-react';
import {
  useCalendarSubscriptions,
  useCreateCalendarSubscription,
  useProjectAssignments,
} from '@/hooks/queries/use-assignments';
import { toast } from 'sonner';
import type { CalendarEvent } from '@/types/calendar';
import type { Project } from '@/types';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { BookingStatusBadge } from '@/components/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ProjectCalendarContentProps {
  project: Project;
  isAdmin: boolean;
}

export function ProjectCalendarContent({ project, isAdmin }: ProjectCalendarContentProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'calendar' | 'list'>('calendar');

  const { data: subscriptions } = useCalendarSubscriptions();
  const { data: assignments, isLoading: isLoadingAssignments } = useProjectAssignments(project.id);
  const createSubscription = useCreateCalendarSubscription();

  const handleEventClick = (event: CalendarEvent) => {
    // Could open an assignment detail dialog here
    toast.info(`Selected ${event.userName}'s assignment`, {
      description: `Status: ${event.bookingStatus}`,
    });
  };

  const handleGetICalLink = async () => {
    try {
      const result = await createSubscription.mutateAsync({
        feedType: 'project',
        projectId: project.id,
      });

      await navigator.clipboard.writeText(result.url);
      toast.success('Calendar link copied to clipboard!', {
        description: 'Paste this URL in your calendar app to subscribe',
      });
    } catch (error) {
      toast.error('Failed to generate calendar link');
    }
  };

  const existingProjectSub = subscriptions?.find(
    s => s.feed_type === 'project' && s.project_id === project.id
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'calendar' | 'list')}>
          <TabsList>
            <TabsTrigger value="calendar">
              Calendar View
            </TabsTrigger>
            <TabsTrigger value="list">
              <ListTodo className="mr-2 h-4 w-4" />
              List View
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {existingProjectSub ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
                const url = `${baseUrl}/api/calendar/ical/${existingProjectSub.token}`;
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

      {/* Content */}
      {activeTab === 'calendar' ? (
        <ProjectCalendar
          project={project}
          onEventClick={handleEventClick}
          enableDragDrop={isAdmin}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Assignments
            </CardTitle>
            <CardDescription>
              {assignments?.length || 0} team member{(assignments?.length || 0) !== 1 ? 's' : ''} assigned
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAssignments ? (
              <p className="text-sm text-muted-foreground">Loading assignments...</p>
            ) : assignments && assignments.length > 0 ? (
              <div className="space-y-3">
                {assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {assignment.user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??'}
                      </div>
                      <div>
                        <p className="font-medium">{assignment.user?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{assignment.user?.email}</p>
                      </div>
                    </div>
                    <BookingStatusBadge status={assignment.booking_status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No team members assigned yet</p>
                {isAdmin && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Switch to Calendar View and drag team members to assign them
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Help text */}
      {isAdmin && activeTab === 'calendar' && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
          <p className="font-medium mb-2">Drag & Drop Assignments</p>
          <p>
            Drag team members from the sidebar and drop them anywhere on the calendar to assign
            them to this project. They&apos;ll automatically be assigned for the full project duration.
          </p>
        </div>
      )}

      </div>
  );
}

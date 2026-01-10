'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProjectCalendar, BulkAssignDialog } from '@/components/calendar';
import { Button } from '@/components/ui/button';
import { Users, ListTodo, UserPlus } from 'lucide-react';
import { useProjectAssignments } from '@/hooks/queries/use-assignments';
import { toast } from 'sonner';
import type { CalendarEvent } from '@/types/calendar';
import type { Project } from '@/types';
import { BookingStatusBadge } from '@/components/calendar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ProjectCalendarContentProps {
  project: Project;
  isAdmin: boolean;
}

export function ProjectCalendarContent({ project, isAdmin }: ProjectCalendarContentProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'calendar' | 'list'>('calendar');
  const [showBulkAssign, setShowBulkAssign] = useState(false);

  const { data: assignments, isLoading: isLoadingAssignments } = useProjectAssignments(project.id);

  const handleEventClick = (event: CalendarEvent) => {
    // Navigate to the project page
    router.push(`/projects/${project.sales_order_number}`);
  };

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
          {isAdmin && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowBulkAssign(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Bulk Assign
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

      {/* Bulk Assign Dialog */}
      <BulkAssignDialog
        open={showBulkAssign}
        onOpenChange={setShowBulkAssign}
        projectId={project.id}
        projectName={project.client_name}
      />
    </div>
  );
}

'use client';

import { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useOdooActivities } from '@/hooks/queries/use-odoo-activities';
import { cn } from '@/lib/utils';
import type { OdooActivityResult } from '@/types/odoo';

interface OdooActivitiesSectionProps {
  userEmail: string | null;
}

function countOverdue(activities: OdooActivityResult[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return activities.filter(
    (a) => a.deadline && new Date(a.deadline + 'T00:00:00') < today
  ).length;
}

export function OdooActivitiesSection({ userEmail }: OdooActivitiesSectionProps) {
  const { data, isLoading } = useOdooActivities(userEmail);

  // Don't render if Odoo isn't configured or no email
  if (!userEmail) return null;
  if (!isLoading && data && !data.configured) return null;
  if (
    !isLoading &&
    data &&
    data.myActivities.length === 0 &&
    data.assignedByMe.length === 0
  )
    return null;

  const myOverdue = data ? countOverdue(data.myActivities) : 0;
  const assignedOverdue = data ? countOverdue(data.assignedByMe) : 0;

  return (
    <div className="space-y-4">
      {/* My Odoo Activities */}
      {(isLoading || (data && data.myActivities.length > 0)) && (
        <ActivityCollapsible
          title="My Odoo Activities"
          activities={data?.myActivities ?? []}
          overdueCount={myOverdue}
          isLoading={isLoading}
          variant="mine"
        />
      )}

      {/* Assigned by Me */}
      {(isLoading || (data && data.assignedByMe.length > 0)) && (
        <ActivityCollapsible
          title="Odoo Activities I Assigned"
          activities={data?.assignedByMe ?? []}
          overdueCount={assignedOverdue}
          isLoading={isLoading}
          variant="assigned"
        />
      )}
    </div>
  );
}

function ActivityCollapsible({
  title,
  activities,
  overdueCount,
  isLoading,
  variant,
}: {
  title: string;
  activities: OdooActivityResult[];
  overdueCount: number;
  isLoading: boolean;
  variant: 'mine' | 'assigned';
}) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className="space-y-3">
        <CollapsibleTrigger className="flex items-center gap-3 w-full group cursor-pointer">
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              !open && '-rotate-90'
            )}
          />
          <h2 className="text-lg font-semibold">{title}</h2>
          <Badge
            variant="outline"
            className="text-xs bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800"
          >
            Odoo
          </Badge>
          {!isLoading && (
            <span className="text-sm text-muted-foreground">
              {activities.length} open
            </span>
          )}
          {!isLoading && overdueCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {overdueCount} overdue
            </Badge>
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          {isLoading ? (
            <div className="h-20 animate-pulse rounded-md bg-muted" />
          ) : (
            <div className="space-y-1">
              {activities.map((activity) => (
                <OdooActivityRow
                  key={activity.id}
                  activity={activity}
                  showAssignedTo={variant === 'assigned'}
                />
              ))}
            </div>
          )}
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function OdooActivityRow({
  activity,
  showAssignedTo,
}: {
  activity: OdooActivityResult;
  showAssignedTo?: boolean;
}) {
  const isOverdue =
    activity.deadline &&
    new Date(activity.deadline + 'T00:00:00') < new Date();

  return (
    <div className="flex items-center gap-3 rounded-md border border-l-4 border-l-purple-400 p-3 hover:bg-muted/30">
      <div className="flex-1 min-w-0">
        <p className="text-sm">{activity.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {activity.type}
          </Badge>
          {showAssignedTo && activity.assignedTo && (
            <span className="text-xs text-muted-foreground">
              to {activity.assignedTo}
            </span>
          )}
          {!showAssignedTo && activity.assignedBy && (
            <span className="text-xs text-muted-foreground">
              from {activity.assignedBy}
            </span>
          )}
          {activity.recordName && activity.recordName !== activity.name && (
            <span className="text-xs text-muted-foreground">
              on {activity.recordName}
            </span>
          )}
        </div>
      </div>
      {activity.deadline && (
        <span
          className={cn(
            'text-xs whitespace-nowrap',
            isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'
          )}
        >
          {new Date(activity.deadline + 'T00:00:00').toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      )}
      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
        <a
          href={activity.odooUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in Odoo"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </Button>
    </div>
  );
}

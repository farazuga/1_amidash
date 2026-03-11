'use client';

import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOdooActivities } from '@/hooks/queries/use-odoo-activities';
import { cn } from '@/lib/utils';
import type { OdooActivityResult } from '@/types/odoo';

interface OdooActivitiesSectionProps {
  userEmail: string | null;
}

export function OdooActivitiesSection({ userEmail }: OdooActivitiesSectionProps) {
  const { data, isLoading } = useOdooActivities(userEmail);

  // Don't render if Odoo isn't configured or no email
  if (!userEmail) return null;
  if (!isLoading && data && !data.configured) return null;
  if (!isLoading && data && data.activities.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Odoo Activities</h2>
        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800">
          Odoo
        </Badge>
        {!isLoading && data && (
          <span className="text-sm text-muted-foreground">
            {data.activities.length} open
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="h-20 animate-pulse rounded-md bg-muted" />
      ) : (
        <div className="space-y-1">
          {data?.activities.map((activity) => (
            <OdooActivityRow key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </section>
  );
}

function OdooActivityRow({ activity }: { activity: OdooActivityResult }) {
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
          {activity.assignedBy && (
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

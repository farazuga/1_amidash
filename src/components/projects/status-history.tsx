'use client';

import { format } from 'date-fns';
import { StatusBadge } from './status-badge';

interface StatusHistoryProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  history: any[];
}

export function StatusHistory({ history }: StatusHistoryProps) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No status changes yet</p>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((item, index) => (
        <div
          key={item.id}
          className="relative pl-6 pb-4 last:pb-0"
        >
          {/* Timeline line */}
          {index !== history.length - 1 && (
            <div className="absolute left-[9px] top-6 h-full w-0.5 bg-border" />
          )}

          {/* Timeline dot */}
          <div className="absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border-2 border-primary bg-background" />

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusBadge status={item.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {item.changed_at ? format(new Date(item.changed_at), 'MMM d, yyyy h:mm a') : '-'}
              {item.changed_by_profile && (
                <> by {item.changed_by_profile.full_name || item.changed_by_profile.email}</>
              )}
            </p>
            {item.note && (
              <p className="text-sm mt-1 p-2 bg-muted rounded-md">
                {item.note}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

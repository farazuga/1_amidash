'use client';

import { format } from 'date-fns';

interface StatusTimelineProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  history: any[];
}

export function StatusTimeline({ history }: StatusTimelineProps) {
  if (history.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-4">
        No status updates yet
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((item, index) => (
        <div
          key={item.id}
          className="relative pl-8 pb-4 last:pb-0"
        >
          {/* Timeline line */}
          {index !== history.length - 1 && (
            <div className="absolute left-[11px] top-6 h-full w-0.5 bg-[#023A2D]/20" />
          )}

          {/* Timeline dot */}
          <div
            className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center ${
              index === 0
                ? 'bg-[#023A2D] text-white'
                : 'bg-[#023A2D]/20 text-[#023A2D]'
            }`}
          >
            {index === 0 ? (
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <div className="w-2 h-2 rounded-full bg-[#023A2D]" />
            )}
          </div>

          <div>
            <p className="font-medium text-[#023A2D]">
              {item.status?.name || 'Unknown Status'}
            </p>
            <p className="text-sm text-muted-foreground">
              {item.changed_at ? (
                <>{format(new Date(item.changed_at), 'MMMM d, yyyy')} at{' '}
                {format(new Date(item.changed_at), 'h:mm a')}</>
              ) : '-'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

'use client';

import { cn } from '@/lib/utils';
import type { Status } from '@/types';

interface ProgressBarProps {
  currentStatus: Status | null;
  statuses: Status[];
  isOnHold: boolean;
}

export function ProgressBar({ currentStatus, statuses, isOnHold }: ProgressBarProps) {
  // Filter out Hold status for the progress display (it's a side state)
  const progressStatuses = statuses.filter(s => s.name !== 'Hold');

  const currentIndex = currentStatus
    ? progressStatuses.findIndex(s => s.id === currentStatus.id)
    : -1;

  // If on hold, find the last non-hold status progress
  const progressPercent = isOnHold
    ? (currentStatus?.progress_percent || 0)
    : (currentStatus?.progress_percent || 0);

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="relative">
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isOnHold ? 'bg-orange-500' : 'bg-[#023A2D]'
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="absolute right-0 top-5 text-sm font-medium">
          {progressPercent}% Complete
        </div>
      </div>

      {/* Status steps */}
      <div className="relative mt-8">
        <div className="flex justify-between">
          {progressStatuses.map((status, index) => {
            const isCompleted = currentStatus
              ? status.display_order < currentStatus.display_order ||
                (status.id === currentStatus.id && status.name === 'Invoiced')
              : false;
            const isCurrent = status.id === currentStatus?.id;

            return (
              <div
                key={status.id}
                className="flex flex-col items-center relative"
                style={{ width: `${100 / progressStatuses.length}%` }}
              >
                {/* Connector line */}
                {index > 0 && (
                  <div
                    className={cn(
                      'absolute h-0.5 top-3 right-1/2 left-auto',
                      isCompleted || isCurrent ? 'bg-[#023A2D]' : 'bg-gray-300'
                    )}
                    style={{ width: '100%', transform: 'translateX(-50%)' }}
                  />
                )}

                {/* Status dot */}
                <div
                  className={cn(
                    'w-6 h-6 rounded-full border-2 z-10 flex items-center justify-center',
                    isCompleted
                      ? 'bg-[#023A2D] border-[#023A2D]'
                      : isCurrent
                      ? isOnHold
                        ? 'bg-orange-500 border-orange-500'
                        : 'bg-[#023A2D] border-[#023A2D]'
                      : 'bg-white border-gray-300'
                  )}
                >
                  {isCompleted && (
                    <svg
                      className="w-3 h-3 text-white"
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
                  )}
                </div>

                {/* Status label */}
                <span
                  className={cn(
                    'text-xs mt-2 text-center px-1',
                    isCurrent
                      ? 'font-semibold text-[#023A2D]'
                      : isCompleted
                      ? 'text-[#023A2D]'
                      : 'text-gray-400'
                  )}
                >
                  {status.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

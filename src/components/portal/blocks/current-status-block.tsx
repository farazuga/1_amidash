import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AnimatedProgressBar } from '@/components/portal/animated-progress-bar';
import { StatusAnimation, statusColors, statusMessages } from '@/components/portal/status-animations';
import type { Status } from '@/types';

interface CurrentStatusBlockProps {
  project: {
    client_name: string;
    sales_order_number: string | null;
    poc_name: string | null;
  };
  currentStatus: Status | null;
  filteredStatuses: Status[];
  isOnHold: boolean;
}

export function CurrentStatusBlock({
  project,
  currentStatus,
  filteredStatuses,
  isOnHold,
}: CurrentStatusBlockProps) {
  const accentColor = isOnHold
    ? '#F97316'
    : currentStatus?.name
      ? statusColors[currentStatus.name]?.accent || '#023A2D'
      : '#023A2D';

  return (
    <Card className="mb-4 border-[#023A2D]/20 overflow-hidden">
      <div className="h-1.5" style={{ backgroundColor: accentColor }} />

      <CardContent className="pt-5 pb-5">
        {/* Greeting row */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-[#023A2D] truncate">
                {project.client_name}
              </h1>
              {project.sales_order_number && (
                <span className="text-sm text-muted-foreground font-medium flex-shrink-0">
                  #{project.sales_order_number}
                </span>
              )}
            </div>
            {project.poc_name && (
              <p className="text-sm text-muted-foreground mt-1">
                Hi {project.poc_name.split(' ')[0]}! Here&apos;s your latest update.
              </p>
            )}
          </div>
          <div className="w-16 h-16 flex-shrink-0">
            <StatusAnimation statusName={currentStatus?.name || 'PO Received'} />
          </div>
        </div>

        {/* Status area */}
        <div className="bg-gray-50 rounded-xl px-5 py-4 mb-5 text-center">
          <Badge
            className="text-lg px-6 py-2 shadow-sm border-0 mb-3 font-semibold tracking-wide"
            style={{
              backgroundColor: isOnHold
                ? '#F97316'
                : statusColors[currentStatus?.name || '']?.accent || '#023A2D',
              color: 'white',
            }}
          >
            {isOnHold ? 'On Hold' : currentStatus?.name || 'Pending'}
          </Badge>
          <p className="text-sm text-gray-600 leading-relaxed">
            {isOnHold
              ? statusMessages['Hold']
              : statusMessages[currentStatus?.name || ''] || "We're working on your project!"}
          </p>
        </div>

        <AnimatedProgressBar
          currentStatus={currentStatus}
          statuses={filteredStatuses}
          isOnHold={isOnHold}
        />
      </CardContent>
    </Card>
  );
}

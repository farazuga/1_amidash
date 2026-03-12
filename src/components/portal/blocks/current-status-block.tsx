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
  return (
    <Card className="mb-4 border-[#023A2D]/20 overflow-hidden">
      <div
        className="h-1.5"
        style={{
          backgroundColor: currentStatus?.name
            ? statusColors[currentStatus.name]?.accent || '#023A2D'
            : '#023A2D',
        }}
      />
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-[#023A2D] truncate">
                {project.client_name}
              </h1>
              {project.sales_order_number && (
                <span className="text-sm text-muted-foreground font-medium">
                  #{project.sales_order_number}
                </span>
              )}
            </div>
            {project.poc_name && (
              <p className="text-sm text-muted-foreground">
                Hi {project.poc_name.split(' ')[0]}! Here&apos;s your update.
              </p>
            )}
          </div>
          <div className="w-20 h-20 flex-shrink-0">
            <StatusAnimation statusName={currentStatus?.name || 'PO Received'} />
          </div>
        </div>

        <div className="border-t mb-4" />

        <div className="text-center mb-4">
          <Badge
            className="text-base px-5 py-1.5 shadow-md border-2 mb-2"
            style={{
              backgroundColor: isOnHold
                ? '#FED7AA'
                : statusColors[currentStatus?.name || '']?.accent || '#023A2D',
              color: 'white',
              borderColor: isOnHold
                ? '#F97316'
                : statusColors[currentStatus?.name || '']?.accent || '#023A2D',
            }}
          >
            {currentStatus?.name || 'Pending'}
          </Badge>
          <p className="text-sm text-muted-foreground italic">
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

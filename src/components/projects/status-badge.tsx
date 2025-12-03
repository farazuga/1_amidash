import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Status } from '@/types';

interface StatusBadgeProps {
  status: Status | null | undefined;
  showProgress?: boolean;
}

const statusColors: Record<string, string> = {
  'PO Received': 'bg-blue-100 text-blue-800 border-blue-200',
  'Engineering Review': 'bg-purple-100 text-purple-800 border-purple-200',
  'In Procurement': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Pending Scheduling': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Scheduled': 'bg-orange-100 text-orange-800 border-orange-200',
  'IP': 'bg-green-100 text-green-800 border-green-200',
  'Hold': 'bg-red-100 text-red-800 border-red-200',
  'Invoiced': 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export function StatusBadge({ status, showProgress = false }: StatusBadgeProps) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        No Status
      </Badge>
    );
  }

  const colorClass = statusColors[status.name] || 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <Badge className={cn('font-medium', colorClass)} variant="outline">
      {status.name}
      {showProgress && ` (${status.progress_percent}%)`}
    </Badge>
  );
}

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePerDiemBalance } from '@/hooks/queries/use-per-diems';
import { formatCurrency } from '@/lib/per-diem/utils';
import { cn } from '@/lib/utils';

interface BalanceCardProps {
  userId?: string;
}

export function BalanceCard({ userId }: BalanceCardProps) {
  const { data, isLoading } = usePerDiemBalance(userId);

  const balance = data?.balance ?? 0;
  const totalDeposited = data?.total_deposited ?? 0;
  const totalSpent = data?.total_spent ?? 0;
  const totalPending = data?.total_pending ?? 0;

  const metrics = [
    {
      label: 'Current Balance',
      value: balance,
      className: balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-600' : undefined,
    },
    {
      label: 'Total Deposited',
      value: totalDeposited,
    },
    {
      label: 'Total Spent',
      value: totalSpent,
    },
    {
      label: 'Pending',
      value: totalPending,
      className: 'text-amber-600',
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <Card key={metric.label}>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {metric.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className={cn('text-2xl font-bold', metric.className)}>
                {formatCurrency(metric.value)}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

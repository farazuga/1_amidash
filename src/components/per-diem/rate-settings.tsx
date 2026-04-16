'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePerDiemRates, useUpdateRates } from '@/hooks/queries/use-per-diems';

export function RateSettings() {
  const { data: rates, isLoading } = usePerDiemRates();
  const updateRates = useUpdateRates();

  const [inStateRate, setInStateRate] = useState<string>('');
  const [outOfStateRate, setOutOfStateRate] = useState<string>('');

  // Sync local state when rates load
  useEffect(() => {
    if (rates) {
      setInStateRate(String(rates.in_state_rate));
      setOutOfStateRate(String(rates.out_of_state_rate));
    }
  }, [rates]);

  const hasChanges =
    rates !== undefined &&
    (parseFloat(Number(inStateRate).toFixed(2)) !== parseFloat(Number(rates.in_state_rate).toFixed(2)) ||
      parseFloat(Number(outOfStateRate).toFixed(2)) !== parseFloat(Number(rates.out_of_state_rate).toFixed(2)));

  const isValid =
    inStateRate !== '' &&
    outOfStateRate !== '' &&
    !isNaN(Number(inStateRate)) &&
    !isNaN(Number(outOfStateRate)) &&
    Number(inStateRate) >= 0 &&
    Number(outOfStateRate) >= 0;

  function handleSave() {
    if (!isValid) return;
    updateRates.mutate(
      {
        in_state_rate: Number(inStateRate),
        out_of_state_rate: Number(outOfStateRate),
      },
      {
        onSuccess: () => toast.success('Rates updated'),
        onError: (error) => toast.error(error.message || 'Failed to update rates'),
      }
    );
  }

  const formattedDate = rates?.updated_at
    ? new Date(rates.updated_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Per Diem Rates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="in-state-rate">In-State Daily Rate</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="in-state-rate"
                  type="number"
                  min={0}
                  step="0.01"
                  value={inStateRate}
                  onChange={(e) => setInStateRate(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="out-of-state-rate">Out-of-State Daily Rate</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="out-of-state-rate"
                  type="number"
                  min={0}
                  step="0.01"
                  value={outOfStateRate}
                  onChange={(e) => setOutOfStateRate(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || !isValid || updateRates.isPending}
          >
            {updateRates.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Rates
          </Button>
          {formattedDate && (
            <p className="text-sm text-muted-foreground">Last updated {formattedDate}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

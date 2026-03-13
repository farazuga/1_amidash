'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DollarSign, CalendarIcon, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ACDealDisplay } from '@/types/activecampaign';

function formatDealValue(cents: string): string {
  const dollars = parseInt(cents, 10) / 100;
  if (dollars >= 1000000) return `$${(dollars / 1000000).toFixed(1)}M`;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(0)}K`;
  return `$${dollars.toLocaleString()}`;
}

export function UpcomingDealsContent() {
  const [deals, setDeals] = useState<ACDealDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    async function fetchDeals() {
      try {
        setLoading(true);
        const res = await fetch('/api/activecampaign/deals');
        const data = await res.json();
        if (data.error && !data.deals?.length) {
          setError(data.error);
        }
        setDeals(data.deals || []);
      } catch {
        setError('Failed to load deals');
      } finally {
        setLoading(false);
      }
    }
    fetchDeals();
  }, []);

  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      const dealDate = parseISO(deal.cdate);
      if (startDate && dealDate < startDate) return false;
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (dealDate > endOfDay) return false;
      }
      return true;
    });
  }, [deals, startDate, endDate]);

  const totalValue = useMemo(() => {
    return filteredDeals.reduce((sum, deal) => sum + parseInt(deal.value, 10) / 100, 0);
  }, [filteredDeals]);

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const hasFilters = startDate || endDate;

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Upcoming Deals</h1>
        <div className="text-muted-foreground">Loading deals...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Upcoming Deals</h1>
        <p className="text-sm text-muted-foreground">
          Solution Pipeline &middot; Verbal Commit
        </p>
      </div>

      {error && (
        <div className="text-sm text-amber-600 bg-amber-50 rounded-md p-3">
          {error}
        </div>
      )}

      {/* Summary + Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Card className="flex-shrink-0">
          <CardContent className="flex items-center gap-2 py-3 px-4">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total Pipeline Value</p>
              <p className="text-lg font-semibold">
                {formatDealValue(String(totalValue * 100))}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {startDate ? format(startDate, 'MMM d, yyyy') : 'Start date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
              />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground">to</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {endDate ? format(endDate, 'MMM d, yyyy') : 'End date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
              />
            </PopoverContent>
          </Popover>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}
        </div>

        <span className="text-sm text-muted-foreground">
          {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Deals Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Value</th>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      {deals.length === 0
                        ? 'No deals found in Verbal Commit stage'
                        : 'No deals match the selected date range'}
                    </td>
                  </tr>
                ) : (
                  filteredDeals.map((deal) => (
                    <tr key={deal.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{deal.title}</td>
                      <td className="px-4 py-3">{formatDealValue(deal.value)}</td>
                      <td className="px-4 py-3">{deal.accountName || '\u2014'}</td>
                      <td className="px-4 py-3">{deal.contactName || '\u2014'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(parseISO(deal.cdate), 'MMM d, yyyy')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

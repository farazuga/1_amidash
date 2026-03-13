'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import type { ACDealDisplay } from '@/types/activecampaign';
import { createClient } from '@/lib/supabase/client';
import { MonthHeroCard } from './month-hero-card';
import { PipelineOutlook } from './pipeline-outlook';
import type { MonthSummary } from './pipeline-outlook';
import { DealMonthSection } from './deal-month-section';

export function UpcomingDealsContent() {
  const [deals, setDeals] = useState<ACDealDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<Map<string, number>>(new Map());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const currentMonth = format(new Date(), 'yyyy-MM');

  // Fetch deals and revenue goals in parallel on mount
  useEffect(() => {
    async function fetchDeals() {
      try {
        const res = await fetch('/api/activecampaign/deals');
        const data = await res.json();
        if (data.error && !data.deals?.length) {
          setError(data.error);
        }
        setDeals(data.deals || []);
      } catch {
        setError('Failed to load deals');
      }
    }

    async function fetchGoals() {
      try {
        const supabase = createClient();
        const { data, error: goalsError } = await (supabase.from as any)('revenue_goals')
          .select('year, month, revenue_goal');
        if (goalsError) {
          console.error('Failed to fetch revenue goals:', goalsError);
          return;
        }
        const goalsMap = new Map<string, number>();
        for (const row of data || []) {
          const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
          goalsMap.set(key, Number(row.revenue_goal));
        }
        setGoals(goalsMap);
      } catch (err) {
        console.error('Failed to fetch revenue goals:', err);
      }
    }

    Promise.all([fetchDeals(), fetchGoals()]).finally(() => setLoading(false));
  }, []);

  // Initialize expandedMonths with current month once deals load
  useEffect(() => {
    if (deals.length > 0 && expandedMonths.size === 0 && !allExpanded) {
      setExpandedMonths(new Set([currentMonth]));
    }
  }, [deals, currentMonth, expandedMonths.size, allExpanded]);

  // Group deals by month
  const { monthGroups, sortedMonthKeys, unscheduledDeals } = useMemo(() => {
    const groups = new Map<string, ACDealDisplay[]>();
    const unscheduled: ACDealDisplay[] = [];

    for (const deal of deals) {
      if (!deal.forecastCloseDate) {
        unscheduled.push(deal);
        continue;
      }
      const key = deal.forecastCloseDate.slice(0, 7);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(deal);
    }

    const sorted = Array.from(groups.keys()).sort();

    return { monthGroups: groups, sortedMonthKeys: sorted, unscheduledDeals: unscheduled };
  }, [deals]);

  // Compute value for a group of deals (in dollars)
  const groupValue = useCallback((groupDeals: ACDealDisplay[]) => {
    return groupDeals.reduce((sum, d) => sum + parseInt(d.value, 10) / 100, 0);
  }, []);

  // Hero card data for current month
  const heroData = useMemo(() => {
    const currentDeals = monthGroups.get(currentMonth) || [];
    if (currentDeals.length === 0) return null;

    const confirmed = currentDeals.filter((d) => d.hasConfirmedPO);
    const verbal = currentDeals.filter((d) => !d.hasConfirmedPO);

    return {
      confirmedPOValue: groupValue(confirmed),
      confirmedPOCount: confirmed.length,
      verbalCommitValue: groupValue(verbal),
      verbalCommitCount: verbal.length,
    };
  }, [monthGroups, currentMonth, groupValue]);

  // Pipeline outlook months
  const pipelineMonths: MonthSummary[] = useMemo(() => {
    return sortedMonthKeys.map((key) => {
      const monthDeals = monthGroups.get(key)!;
      const date = parseISO(`${key}-01`);
      return {
        key,
        label: format(date, 'MMMM yyyy'),
        dealCount: monthDeals.length,
        value: groupValue(monthDeals),
        goal: goals.get(key) ?? null,
      };
    });
  }, [sortedMonthKeys, monthGroups, goals, groupValue]);

  const totalDeals = deals.length;
  const totalValue = useMemo(() => groupValue(deals), [deals, groupValue]);

  const unscheduledSummary = useMemo(() => {
    if (unscheduledDeals.length === 0) return null;
    return { dealCount: unscheduledDeals.length, value: groupValue(unscheduledDeals) };
  }, [unscheduledDeals, groupValue]);

  // Expand/collapse handlers
  const handleToggleExpandAll = useCallback(() => {
    setAllExpanded((prev) => {
      const next = !prev;
      if (next) {
        setExpandedMonths(new Set([...sortedMonthKeys, ...(unscheduledDeals.length > 0 ? ['unscheduled'] : [])]));
      } else {
        setExpandedMonths(new Set());
      }
      return next;
    });
  }, [sortedMonthKeys, unscheduledDeals.length]);

  const handleToggleMonth = useCallback((key: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleMonthClick = useCallback((monthKey: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      next.add(monthKey);
      return next;
    });

    // Scroll to section after a tick to allow expand
    requestAnimationFrame(() => {
      const el = sectionRefs.current[monthKey];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Upcoming Deals</h1>
          <p className="text-sm text-muted-foreground">Solutions Pipeline &middot; Verbal Commit</p>
        </div>
        <div className="space-y-4">
          <div className="h-40 rounded-lg bg-muted animate-pulse" />
          <div className="h-48 rounded-lg bg-muted animate-pulse" />
          <div className="h-14 rounded-lg bg-muted animate-pulse" />
          <div className="h-14 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  const currentMonthGoal = goals.get(currentMonth) ?? 0;
  const showHero = heroData !== null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Upcoming Deals</h1>
        <p className="text-sm text-muted-foreground">
          Solutions Pipeline &middot; Verbal Commit
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-amber-600 bg-amber-50 rounded-md p-3">
          {error}
        </div>
      )}

      {/* Empty state */}
      {deals.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No deals found in Verbal Commit stage
        </div>
      )}

      {/* Hero Card */}
      {deals.length > 0 && showHero && (
        <MonthHeroCard
          monthLabel={format(parseISO(`${currentMonth}-01`), 'MMMM yyyy')}
          goal={currentMonthGoal}
          confirmedPOValue={heroData.confirmedPOValue}
          confirmedPOCount={heroData.confirmedPOCount}
          verbalCommitValue={heroData.verbalCommitValue}
          verbalCommitCount={heroData.verbalCommitCount}
        />
      )}

      {/* Pipeline Outlook */}
      {deals.length > 0 && <PipelineOutlook
        months={pipelineMonths}
        unscheduled={unscheduledSummary}
        totalDeals={totalDeals}
        totalValue={totalValue}
        allExpanded={allExpanded}
        onToggleExpandAll={handleToggleExpandAll}
        onMonthClick={handleMonthClick}
      />}

      {/* Month Sections */}
      {sortedMonthKeys.map((key) => {
        const monthDeals = monthGroups.get(key)!;
        const date = parseISO(`${key}-01`);
        const label = format(date, 'MMMM yyyy');
        return (
          <div key={key} ref={(el) => { sectionRefs.current[key] = el; }}>
            <DealMonthSection
              label={label}
              deals={monthDeals}
              totalValue={groupValue(monthDeals)}
              isOpen={expandedMonths.has(key)}
              onToggle={() => handleToggleMonth(key)}
            />
          </div>
        );
      })}

      {/* Unscheduled Section */}
      {unscheduledDeals.length > 0 && (
        <div ref={(el) => { sectionRefs.current['unscheduled'] = el; }}>
          <DealMonthSection
            label="Unscheduled"
            deals={unscheduledDeals}
            totalValue={groupValue(unscheduledDeals)}
            isOpen={expandedMonths.has('unscheduled')}
            onToggle={() => handleToggleMonth('unscheduled')}
          />
        </div>
      )}
    </div>
  );
}

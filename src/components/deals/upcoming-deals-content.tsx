'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import type { ACDealDisplay } from '@/types/activecampaign';
import { createClient } from '@/lib/supabase/client';
import { ViewToggle } from './view-toggle';
import type { ViewMode } from './view-toggle';
import { TargetTrackerCard } from './target-tracker-card';
import { SlippedDealsCallout } from './slipped-deals-callout';
import { EarlierStageCallout } from './earlier-stage-callout';
import { PipelineOutlook } from './pipeline-outlook';
import type { MonthSummary } from './pipeline-outlook';
import { DealMonthSection } from './deal-month-section';
import { getPresalesFileCounts } from '@/app/(dashboard)/presales-files/actions';
import { getReceivedPOs } from '@/app/(dashboard)/upcoming-deals/actions';
import type { ReceivedPOData } from '@/app/(dashboard)/upcoming-deals/actions';

export function UpcomingDealsContent() {
  const [deals, setDeals] = useState<ACDealDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<Map<string, number>>(new Map());
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [receivedPOs, setReceivedPOs] = useState<Map<string, ReceivedPOData>>(new Map());
  const [allStageDeals, setAllStageDeals] = useState<ACDealDisplay[]>([]);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const currentMonth = format(new Date(), 'yyyy-MM');
  const currentYear = new Date().getFullYear();

  // Fetch deals, revenue goals, and all-stage deals in parallel on mount
  useEffect(() => {
    async function fetchDeals() {
      try {
        const res = await fetch('/api/activecampaign/deals');
        const data = await res.json();
        if (data.error && !data.deals?.length) {
          setError(data.error);
        }
        const fetchedDeals: ACDealDisplay[] = data.deals || [];
        setDeals(fetchedDeals);

        // Fetch file counts for all deals
        const dealIds = fetchedDeals.map((d) => d.id);
        if (dealIds.length > 0) {
          const countsResult = await getPresalesFileCounts(dealIds);
          if (countsResult.success) {
            setFileCounts(countsResult.data);
          }
        }

        // Fetch received POs for each month that has deals + current month
        const monthKeys = Array.from(new Set(
          fetchedDeals
            .filter((d) => d.forecastCloseDate)
            .map((d) => d.forecastCloseDate.slice(0, 7))
        ));
        await fetchReceivedPOs(monthKeys);
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

    async function fetchReceivedPOs(monthKeys: string[]) {
      const uniqueKeys = Array.from(new Set([...monthKeys, currentMonth]));
      const results = await Promise.all(
        uniqueKeys.map(async (key) => {
          const data = await getReceivedPOs(key);
          return { key, data };
        })
      );
      const poMap = new Map<string, ReceivedPOData>();
      for (const { key, data } of results) {
        poMap.set(key, data);
      }
      setReceivedPOs(poMap);
    }

    async function fetchAllStageDeals() {
      try {
        const res = await fetch('/api/activecampaign/deals?stages=all');
        const data = await res.json();
        setAllStageDeals(data.deals || []);
      } catch {
        // Non-critical — earlier-stage callout just won't show
      }
    }

    Promise.all([fetchDeals(), fetchGoals(), fetchAllStageDeals()]).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Target tracker data (monthly or quarterly)
  const trackerData = useMemo(() => {
    if (viewMode === 'monthly') {
      const monthDeals = monthGroups.get(currentMonth) || [];
      const poData = receivedPOs.get(currentMonth);

      // Per-deal segments for the bar
      const receivedPOSegments = (poData?.projects ?? []).map((p) => ({
        label: p.client_name || 'Unknown',
        value: p.sales_amount || 0,
      }));
      const verbalCommitSegments = monthDeals.map((d) => ({
        label: d.title || d.accountName || 'Unknown',
        value: parseInt(d.value, 10) / 100,
      }));

      return {
        periodLabel: format(parseISO(`${currentMonth}-01`), 'MMMM yyyy'),
        goal: goals.get(currentMonth) ?? 0,
        receivedPOValue: poData?.totalValue ?? 0,
        receivedPOCount: poData?.count ?? 0,
        verbalCommitValue: groupValue(monthDeals),
        verbalCommitCount: monthDeals.length,
        receivedPOSegments,
        verbalCommitSegments,
      };
    } else {
      // Quarterly
      const month = new Date().getMonth() + 1;
      const q = Math.ceil(month / 3);
      const startMonth = (q - 1) * 3 + 1;
      const quarterMonths = [startMonth, startMonth + 1, startMonth + 2]
        .map(m => `${currentYear}-${String(m).padStart(2, '0')}`);

      let totalPOValue = 0, totalPOCount = 0, totalVerbalValue = 0, totalVerbalCount = 0, totalGoal = 0;
      for (const mk of quarterMonths) {
        const poData = receivedPOs.get(mk);
        totalPOValue += poData?.totalValue ?? 0;
        totalPOCount += poData?.count ?? 0;
        const monthDeals = monthGroups.get(mk) || [];
        totalVerbalValue += groupValue(monthDeals);
        totalVerbalCount += monthDeals.length;
        totalGoal += goals.get(mk) ?? 0;
      }

      return {
        periodLabel: `Q${q} ${currentYear}`,
        goal: totalGoal,
        receivedPOValue: totalPOValue,
        receivedPOCount: totalPOCount,
        verbalCommitValue: totalVerbalValue,
        verbalCommitCount: totalVerbalCount,
      };
    }
  }, [viewMode, monthGroups, currentMonth, currentYear, receivedPOs, goals, groupValue]);

  // Pipeline outlook months
  const pipelineMonths: MonthSummary[] = useMemo(() => {
    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    return sortedMonthKeys.map((key) => {
      const monthDeals = monthGroups.get(key)!;
      const date = parseISO(`${key}-01`);

      // Compute win rate for past/current months
      const poCount = receivedPOs.get(key)?.count ?? 0;
      const verbalCount = monthDeals.length;
      const isPastOrCurrent = date <= currentMonthStart;
      const winRate = isPastOrCurrent && (poCount + verbalCount) > 0
        ? Math.round((poCount / (poCount + verbalCount)) * 100)
        : null;

      return {
        key,
        label: format(date, 'MMMM yyyy'),
        dealCount: monthDeals.length,
        value: groupValue(monthDeals),
        goal: goals.get(key) ?? null,
        winRate,
      };
    });
  }, [sortedMonthKeys, monthGroups, goals, groupValue, receivedPOs]);

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Upcoming Deals</h1>
        <div className="flex items-center gap-3">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          <p className="text-sm text-muted-foreground">
            Solutions Pipeline &middot; Verbal Commit
          </p>
        </div>
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

      {/* Target Tracker Card */}
      {deals.length > 0 && (
        <TargetTrackerCard
          periodLabel={trackerData.periodLabel}
          goal={trackerData.goal}
          receivedPOValue={trackerData.receivedPOValue}
          receivedPOCount={trackerData.receivedPOCount}
          verbalCommitValue={trackerData.verbalCommitValue}
          verbalCommitCount={trackerData.verbalCommitCount}
          receivedPOSegments={'receivedPOSegments' in trackerData ? trackerData.receivedPOSegments : undefined}
          verbalCommitSegments={'verbalCommitSegments' in trackerData ? trackerData.verbalCommitSegments : undefined}
        />
      )}

      {/* Slipped Deals Callout */}
      {deals.length > 0 && <SlippedDealsCallout deals={deals} />}

      {/* Earlier Stage Callout */}
      {allStageDeals.length > 0 && (
        <EarlierStageCallout
          deals={allStageDeals}
          currentMonthKey={currentMonth}
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
        viewMode={viewMode}
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
              fileCounts={fileCounts}
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
            fileCounts={fileCounts}
          />
        </div>
      )}
    </div>
  );
}

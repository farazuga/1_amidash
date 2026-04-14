'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ViewMode } from './view-toggle';

interface MonthSummary {
  key: string; // YYYY-MM
  label: string; // "March 2026"
  dealCount: number;
  value: number; // dollars
  goal: number | null; // null if no goal set
  winRate: number | null; // 0-100 percentage, null for future months with no data
}

interface PipelineOutlookProps {
  months: MonthSummary[];
  unscheduled: { dealCount: number; value: number } | null;
  totalDeals: number;
  totalValue: number;
  allExpanded: boolean;
  onToggleExpandAll: () => void;
  onMonthClick: (monthKey: string) => void;
  viewMode?: ViewMode;
}

function getQuarterKey(monthKey: string): string {
  const month = parseInt(monthKey.split('-')[1], 10);
  const year = monthKey.split('-')[0];
  const q = Math.ceil(month / 3);
  return `${year}-Q${q}`;
}

function getQuarterLabel(quarterKey: string): string {
  const [year, q] = quarterKey.split('-');
  return `${q} ${year}`;
}

interface QuarterGroup {
  key: string;
  label: string;
  months: MonthSummary[];
  dealCount: number;
  value: number;
  goal: number | null;
}

function groupByQuarter(months: MonthSummary[]): QuarterGroup[] {
  const map = new Map<string, MonthSummary[]>();
  for (const month of months) {
    const qk = getQuarterKey(month.key);
    if (!map.has(qk)) map.set(qk, []);
    map.get(qk)!.push(month);
  }
  const groups: QuarterGroup[] = [];
  for (const [key, qMonths] of map) {
    const dealCount = qMonths.reduce((s, m) => s + m.dealCount, 0);
    const value = qMonths.reduce((s, m) => s + m.value, 0);
    const goalsPresent = qMonths.some((m) => m.goal !== null);
    const goal = goalsPresent ? qMonths.reduce((s, m) => s + (m.goal ?? 0), 0) : null;
    groups.push({ key, label: getQuarterLabel(key), months: qMonths, dealCount, value, goal });
  }
  return groups;
}

export function PipelineOutlook({
  months,
  unscheduled,
  totalDeals,
  totalValue,
  allExpanded,
  onToggleExpandAll,
  onMonthClick,
  viewMode = 'monthly',
}: PipelineOutlookProps) {
  const formatValue = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
    return `$${v.toLocaleString()}`;
  };

  const renderWinRate = (winRate: number | null) => (
    <span className="text-xs text-muted-foreground w-16 shrink-0 text-right">
      {winRate !== null ? `Win ${Math.round(winRate)}%` : '\u2014'}
    </span>
  );

  const renderProgressBar = (value: number, goal: number | null) => {
    const pct = goal ? Math.round((value / goal) * 100) : null;
    if (pct !== null) {
      return (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
        </div>
      );
    }
    return <span className="text-xs text-muted-foreground flex-1">{'\u2014'}</span>;
  };

  const renderMonthRow = (month: MonthSummary, indent = false) => (
    <button
      key={month.key}
      onClick={() => onMonthClick(month.key)}
      className={`w-full px-4 py-2.5 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left ${indent ? 'pl-8' : ''}`}
    >
      <span className={`w-24 shrink-0 ${indent ? 'text-xs text-muted-foreground' : 'text-sm font-medium'}`}>
        {month.label.split(' ')[0]}
      </span>
      <span className="text-xs text-muted-foreground w-16 shrink-0">
        {month.dealCount} deal{month.dealCount !== 1 ? 's' : ''}
      </span>
      <span className={`w-36 shrink-0 ${indent ? 'text-xs' : 'text-sm'}`}>
        {formatValue(month.value)}
        {month.goal ? (
          <span className="text-muted-foreground"> / {formatValue(month.goal)}</span>
        ) : null}
      </span>
      {indent ? (
        <>
          <span className="flex-1" />
          {renderWinRate(month.winRate)}
        </>
      ) : (
        <>
          {renderProgressBar(month.value, month.goal)}
          {renderWinRate(month.winRate)}
        </>
      )}
    </button>
  );

  const renderQuarterRow = (quarter: QuarterGroup) => {
    const firstMonthKey = quarter.months[0]?.key ?? quarter.key;
    return (
      <button
        key={quarter.key}
        onClick={() => onMonthClick(firstMonthKey)}
        className="w-full px-4 py-2.5 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left bg-muted/20"
      >
        <span className="text-sm font-semibold w-24 shrink-0">{quarter.label}</span>
        <span className="text-xs text-muted-foreground w-16 shrink-0">
          {quarter.dealCount} deal{quarter.dealCount !== 1 ? 's' : ''}
        </span>
        <span className="text-sm font-medium w-36 shrink-0">
          {formatValue(quarter.value)}
          {quarter.goal ? (
            <span className="text-muted-foreground"> / {formatValue(quarter.goal)}</span>
          ) : null}
        </span>
        {renderProgressBar(quarter.value, quarter.goal)}
      </button>
    );
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pipeline Outlook
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpandAll}
            className="gap-1 text-xs"
          >
            {allExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </Button>
        </div>

        <div className="divide-y">
          {viewMode === 'quarterly' ? (
            <>
              {groupByQuarter(months).map((quarter) => (
                <div key={quarter.key}>
                  {renderQuarterRow(quarter)}
                  {quarter.months.map((month) => renderMonthRow(month, true))}
                </div>
              ))}
            </>
          ) : (
            months.map((month) => renderMonthRow(month))
          )}

          {unscheduled && (
            <button
              onClick={() => onMonthClick('unscheduled')}
              className="w-full px-4 py-2.5 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left"
            >
              <span className="text-sm font-medium w-24 shrink-0 italic text-muted-foreground">Unsched.</span>
              <span className="text-xs text-muted-foreground w-16 shrink-0">
                {unscheduled.dealCount} deal{unscheduled.dealCount !== 1 ? 's' : ''}
              </span>
              <span className="text-sm">{formatValue(unscheduled.value)}</span>
              <span className="flex-1" />
              <span className="text-xs text-muted-foreground">{'\u2014'}</span>
            </button>
          )}

          {/* Total row */}
          <div className="px-4 py-2.5 flex items-center gap-4 bg-muted/30">
            <span className="text-sm font-semibold w-24 shrink-0">Total</span>
            <span className="text-xs text-muted-foreground w-16 shrink-0">
              {totalDeals} deal{totalDeals !== 1 ? 's' : ''}
            </span>
            <span className="text-sm font-semibold">{formatValue(totalValue)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export type { MonthSummary };

'use client';

import type { SignageBlock } from '../../actions';
import type { PreviewData } from '../actions';

interface Props {
  block: SignageBlock;
  previewData: PreviewData;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

const CARD_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

export function QuickStatsBlock({ previewData }: Props) {
  const { revenue } = previewData;

  const cards = [
    {
      label: 'Active Projects',
      value: String(revenue.activeProjectCount),
      color: CARD_COLORS[0],
    },
    {
      label: 'Invoiced This Month',
      value: String(revenue.invoicedThisMonthCount),
      color: CARD_COLORS[1],
    },
    {
      label: 'Sales This Month',
      value: formatCurrency(revenue.salesThisMonth),
      color: CARD_COLORS[2],
    },
    {
      label: 'Quarterly Sales',
      value: formatPercent(revenue.quarterPct),
      color: CARD_COLORS[3],
    },
  ];

  return (
    <div className="h-full grid grid-cols-2 grid-rows-2 gap-[clamp(6px,1vw,14px)]">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex flex-col items-center justify-center rounded-2xl"
          style={{ backgroundColor: '#F8F9FA' }}
        >
          <span
            className="font-bold leading-none"
            style={{
              fontSize: 'clamp(22px, 4vw, 60px)',
              color: card.color,
            }}
          >
            {card.value}
          </span>
          <span
            className="font-semibold mt-1 text-center px-2"
            style={{
              fontSize: 'clamp(9px, 1vw, 15px)',
              color: '#6B7280',
            }}
          >
            {card.label}
          </span>
        </div>
      ))}
    </div>
  );
}

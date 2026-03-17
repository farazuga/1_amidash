'use client';

import type { SignageBlock } from '../../actions';
import type { PreviewData, PreviewHighlightPO } from '../actions';

interface Props {
  block: SignageBlock;
  previewData: PreviewData;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function PORow({ po, index }: { po: PreviewHighlightPO; index: number }) {
  const isLargest = po.highlight_reason === 'largest';
  const badgeColor = isLargest ? '#ef4444' : '#1B3B2D';
  const isAlt = index % 2 === 0;

  return (
    <div
      className="flex items-center gap-[clamp(6px,1vw,14px)] rounded-xl px-[clamp(8px,1.2vw,18px)] flex-1 min-h-0"
      style={{ backgroundColor: isAlt ? '#F3F4F6' : 'transparent' }}
    >
      {/* Badge */}
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-lg font-bold text-white"
        style={{
          backgroundColor: badgeColor,
          fontSize: 'clamp(7px, 0.85vw, 13px)',
          paddingLeft: 'clamp(5px, 0.7vw, 10px)',
          paddingRight: 'clamp(5px, 0.7vw, 10px)',
          paddingTop: 'clamp(2px, 0.3vw, 5px)',
          paddingBottom: 'clamp(2px, 0.3vw, 5px)',
          minWidth: 'clamp(44px, 6vw, 80px)',
          letterSpacing: '0.05em',
        }}
      >
        {isLargest ? 'LARGEST' : 'NEWEST'}
      </div>

      {/* PO number + client */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span
          className="font-semibold truncate"
          style={{ fontSize: 'clamp(9px, 1.1vw, 16px)', color: '#111827' }}
        >
          {po.po_number} &mdash; {po.client_name}
        </span>
        <span
          className="truncate"
          style={{ fontSize: 'clamp(7px, 0.85vw, 13px)', color: '#6B7280' }}
        >
          {po.project_name}
        </span>
      </div>

      {/* Amount */}
      <span
        className="flex-shrink-0 font-bold"
        style={{ fontSize: 'clamp(10px, 1.2vw, 18px)', color: '#111827' }}
      >
        {formatCurrency(po.amount)}
      </span>
    </div>
  );
}

export function POHighlightBlock({ previewData }: Props) {
  const { highlightPOs } = previewData;

  if (highlightPOs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        No POs this month
      </div>
    );
  }

  const rows = highlightPOs.slice(0, 4);

  return (
    <div className="h-full flex flex-col gap-[clamp(4px,0.6vw,10px)]">
      {rows.map((po, i) => (
        <PORow key={po.id} po={po} index={i} />
      ))}
    </div>
  );
}

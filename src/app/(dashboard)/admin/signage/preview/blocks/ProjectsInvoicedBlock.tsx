'use client';

import type { SignageBlock } from '../../actions';
import type { PreviewData, PreviewInvoicedProject } from '../actions';

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

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="flex-shrink-0"
      style={{
        width: 'clamp(18px, 2.5vw, 36px)',
        height: 'clamp(18px, 2.5vw, 36px)',
      }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="12" fill="#10b981" />
      <path
        d="M7 12.5l3.5 3.5 6.5-7"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProjectRow({
  project,
  index,
}: {
  project: PreviewInvoicedProject;
  index: number;
}) {
  const isAlt = index % 2 === 0;

  return (
    <div
      className="flex items-center gap-[clamp(6px,1vw,14px)] rounded-xl px-[clamp(8px,1.2vw,18px)] flex-1 min-h-0"
      style={{ backgroundColor: isAlt ? '#F3F4F6' : 'transparent' }}
    >
      <CheckIcon />

      {/* Project name + client */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span
          className="font-bold truncate"
          style={{ fontSize: 'clamp(9px, 1.1vw, 16px)', color: '#111827' }}
        >
          {project.name}
        </span>
        <span
          className="truncate"
          style={{ fontSize: 'clamp(7px, 0.85vw, 13px)', color: '#6B7280' }}
        >
          {project.client_name}
        </span>
      </div>

      {/* Value */}
      <span
        className="flex-shrink-0 font-bold"
        style={{ fontSize: 'clamp(10px, 1.2vw, 18px)', color: '#10b981' }}
      >
        {formatCurrency(project.total_value)}
      </span>
    </div>
  );
}

export function ProjectsInvoicedBlock({ previewData }: Props) {
  const { invoicedProjects } = previewData;

  if (invoicedProjects.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        No invoiced projects
      </div>
    );
  }

  const rows = invoicedProjects.slice(0, 4);

  return (
    <div className="h-full flex flex-col gap-[clamp(4px,0.6vw,10px)]">
      {rows.map((project, i) => (
        <ProjectRow key={project.id} project={project} index={i} />
      ))}
    </div>
  );
}

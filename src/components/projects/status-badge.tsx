import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: { name: string; color?: string | null } | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Enhanced status color config with dot colors (fallback when no DB color)
const statusConfig: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  'PO Received': {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  'Engineering Review': {
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  'In Procurement': {
    bg: 'bg-cyan-50',
    text: 'text-cyan-800',
    border: 'border-cyan-200',
    dot: 'bg-cyan-500',
  },
  'Pending Scheduling': {
    bg: 'bg-yellow-50',
    text: 'text-yellow-800',
    border: 'border-yellow-200',
    dot: 'bg-yellow-500',
  },
  'Scheduled': {
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
  },
  'IP': {
    bg: 'bg-green-50',
    text: 'text-green-800',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  'Hold': {
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
  'Invoiced': {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
};

const defaultConfig = {
  bg: 'bg-gray-50',
  text: 'text-gray-800',
  border: 'border-gray-200',
  dot: 'bg-gray-400',
};

/** Convert hex to an rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Darken a hex color for readable text */
function darkenHex(hex: string, amount = 0.35): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount));
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount));
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount));
  return `rgb(${r}, ${g}, ${b})`;
}

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  if (!status) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border font-medium',
          'bg-muted/50 text-muted-foreground border-muted/80',
          'shadow-sm transition-all duration-200',
          size === 'sm' && 'text-[10px] px-2 py-0.5',
          size === 'md' && 'text-xs px-2.5 py-1',
          size === 'lg' && 'text-sm px-3 py-1.5',
          className
        )}
      >
        <span
          className={cn(
            'rounded-full bg-muted-foreground/40',
            size === 'sm' && 'h-1.5 w-1.5',
            size === 'md' && 'h-2 w-2',
            size === 'lg' && 'h-2.5 w-2.5'
          )}
        />
        No Status
      </span>
    );
  }

  // Use dynamic color from DB when available
  if (status.color) {
    const hex = status.color;
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border font-medium',
          'shadow-sm transition-all duration-200',
          size === 'sm' && 'text-[10px] px-2 py-0.5',
          size === 'md' && 'text-xs px-2.5 py-1',
          size === 'lg' && 'text-sm px-3 py-1.5',
          className
        )}
        style={{
          backgroundColor: hexToRgba(hex, 0.1),
          borderColor: hexToRgba(hex, 0.3),
          color: darkenHex(hex),
        }}
      >
        <span
          className={cn(
            'rounded-full flex-shrink-0',
            size === 'sm' && 'h-1.5 w-1.5',
            size === 'md' && 'h-2 w-2',
            size === 'lg' && 'h-2.5 w-2.5'
          )}
          style={{ backgroundColor: hex }}
        />
        {status.name}
      </span>
    );
  }

  // Fallback to hardcoded config
  const config = statusConfig[status.name] || defaultConfig;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        'shadow-sm transition-all duration-200',
        config.bg,
        config.text,
        config.border,
        size === 'sm' && 'text-[10px] px-2 py-0.5',
        size === 'md' && 'text-xs px-2.5 py-1',
        size === 'lg' && 'text-sm px-3 py-1.5',
        className
      )}
    >
      <span
        className={cn(
          'rounded-full flex-shrink-0',
          config.dot,
          size === 'sm' && 'h-1.5 w-1.5',
          size === 'md' && 'h-2 w-2',
          size === 'lg' && 'h-2.5 w-2.5'
        )}
      />
      {status.name}
    </span>
  );
}

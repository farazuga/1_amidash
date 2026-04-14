'use client';

import { Button } from '@/components/ui/button';

type ViewMode = 'monthly' | 'quarterly';

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-md border">
      <Button
        variant={mode === 'monthly' ? 'default' : 'ghost'}
        size="sm"
        className="rounded-r-none text-xs"
        onClick={() => onChange('monthly')}
      >
        Monthly
      </Button>
      <Button
        variant={mode === 'quarterly' ? 'default' : 'ghost'}
        size="sm"
        className="rounded-l-none text-xs"
        onClick={() => onChange('quarterly')}
      >
        Quarterly
      </Button>
    </div>
  );
}

export type { ViewMode };

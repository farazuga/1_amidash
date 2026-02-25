'use client';

import { L10PageShell } from '@/components/l10/l10-page-shell';

export default function L10Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">L10 Meetings</h1>
        <p className="text-muted-foreground">
          Run structured Level 10 meetings with your team.
        </p>
      </div>
      <L10PageShell />
    </div>
  );
}

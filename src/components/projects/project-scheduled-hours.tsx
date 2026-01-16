'use client';

import { useEffect, useState } from 'react';
import { Clock, Users } from 'lucide-react';
import { getProjectScheduledHours, type ProjectScheduledHoursResult } from '@/app/(dashboard)/projects/actions';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProjectScheduledHoursProps {
  projectId: string;
}

export function ProjectScheduledHours({ projectId }: ProjectScheduledHoursProps) {
  const [data, setData] = useState<ProjectScheduledHoursResult['data'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHours() {
      setLoading(true);
      const result = await getProjectScheduledHours(projectId);
      if (result.success && result.data) {
        setData(result.data);
      }
      setLoading(false);
    }
    fetchHours();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors">
        <span className="text-sm text-muted-foreground">Scheduled Hours</span>
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!data || data.totalHours === 0) {
    return (
      <div className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors">
        <span className="text-sm text-muted-foreground">Scheduled Hours</span>
        <span className="text-sm text-muted-foreground italic">No schedule</span>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Scheduled Hours</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 cursor-help">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium text-sm tabular-nums">
                {data.totalHours}h
              </span>
              <span className="text-xs text-muted-foreground">
                ({data.totalDays} day{data.totalDays !== 1 ? 's' : ''})
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-[250px] p-3">
            <div className="space-y-2">
              <p className="font-semibold text-sm">Breakdown by Engineer</p>
              {data.byEngineer.map((eng) => (
                <div key={eng.userId} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
                    {eng.userName}
                  </span>
                  <span className="font-mono">
                    {eng.hours}h ({eng.days}d)
                  </span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

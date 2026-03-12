import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { CustomerSchedule } from '@/components/portal/customer-schedule';

interface CustomerScheduleBlockProps {
  project: {
    client_name: string;
    start_date: string | null;
    end_date: string | null;
  };
}

export function CustomerScheduleBlock({ project }: CustomerScheduleBlockProps) {
  if (!project.start_date && !project.end_date) return null;

  return (
    <Card className="mb-4 border-[#023A2D]/20">
      <CardHeader className="py-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#023A2D]" />
          <h2 className="text-sm font-semibold text-[#023A2D]">Project Schedule</h2>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <CustomerSchedule
          startDate={project.start_date}
          endDate={project.end_date}
          projectName={project.client_name}
        />
      </CardContent>
    </Card>
  );
}

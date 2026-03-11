import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatusTimeline } from '@/components/portal/status-timeline';

interface StatusHistoryBlockProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  history: any[];
}

export function StatusHistoryBlock({ history }: StatusHistoryBlockProps) {
  return (
    <Card className="mb-4 border-[#023A2D]/20">
      <CardHeader className="py-3">
        <h2 className="text-sm font-semibold text-[#023A2D]">Status History</h2>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <StatusTimeline history={history} />
      </CardContent>
    </Card>
  );
}

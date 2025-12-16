import { Loader2 } from 'lucide-react';

export default function MyScheduleLoading() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <div className="h-8 w-36 bg-muted animate-pulse rounded" />
        <div className="h-4 w-56 bg-muted animate-pulse rounded mt-2" />
      </div>

      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

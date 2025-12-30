'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bulkUpdateScheduleStatus, type BulkUpdateScheduleStatusData } from '@/app/(dashboard)/projects/actions';
import { toast } from 'sonner';

export function useBulkUpdateScheduleStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: BulkUpdateScheduleStatusData) => {
      const result = await bulkUpdateScheduleStatus(data);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update projects');
      }
      return result;
    },
    onSuccess: (data) => {
      // Invalidate project queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['projects-with-dates'] });
      toast.success(`Updated ${data.updatedCount} project${data.updatedCount !== 1 ? 's' : ''}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update projects');
    },
  });
}

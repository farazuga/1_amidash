'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateProjectDates, type UpdateProjectDatesData } from '@/app/(dashboard)/projects/actions';
import { toast } from 'sonner';

export function useUpdateProjectDates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateProjectDatesData) => {
      const result = await updateProjectDates(data);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update dates');
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate project queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['projects-with-dates'] });
      toast.success('Project dates updated');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update project dates');
    },
  });
}

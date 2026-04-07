import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getApprovalTasks,
  getPendingApprovalCount,
  approveFile,
  rejectFile,
} from '@/app/(dashboard)/approvals/actions';

const APPROVAL_TASKS_KEY = ['approvalTasks'];
const PENDING_COUNT_KEY = ['pendingApprovalCount'];

const THIRTY_SECONDS = 30 * 1000;

export function useApprovalTasks(filter: 'pending' | 'approved' | 'rejected' | 'all') {
  return useQuery({
    queryKey: [...APPROVAL_TASKS_KEY, filter],
    queryFn: () => getApprovalTasks(filter),
    staleTime: THIRTY_SECONDS,
  });
}

export function usePendingApprovalCount() {
  return useQuery({
    queryKey: PENDING_COUNT_KEY,
    queryFn: () => getPendingApprovalCount(),
    staleTime: THIRTY_SECONDS,
  });
}

export function useApproveFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => approveFile(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPROVAL_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: PENDING_COUNT_KEY });
    },
  });
}

export function useRejectFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, note }: { taskId: string; note: string }) => rejectFile(taskId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPROVAL_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: PENDING_COUNT_KEY });
    },
  });
}

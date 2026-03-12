import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getScorecard,
  createMeasurable,
  updateMeasurable,
  deleteMeasurable,
  reorderMeasurables,
  upsertScorecardEntry,
  autoPopulateScorecardWeek,
} from '@/app/(dashboard)/l10/scorecard-actions';

export const L10_SCORECARD_KEY = ['l10', 'scorecard'];

const THIRTY_SECONDS = 30 * 1000;

export function useScorecard(teamId: string | null) {
  return useQuery({
    queryKey: [...L10_SCORECARD_KEY, teamId],
    queryFn: async () => {
      if (!teamId) return null;
      const result = await getScorecard(teamId);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!teamId,
  });
}

export function useCreateMeasurable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      scorecardId: string;
      title: string;
      ownerId?: string;
      unit?: string;
      goalValue?: number;
      goalDirection?: string;
      autoSource?: string | null;
    }) => {
      const result = await createMeasurable(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_SCORECARD_KEY });
    },
  });
}

export function useUpdateMeasurable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: string;
      title?: string;
      ownerId?: string | null;
      unit?: string;
      goalValue?: number | null;
      goalDirection?: string;
      autoSource?: string | null;
      isActive?: boolean;
    }) => {
      const result = await updateMeasurable(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_SCORECARD_KEY });
    },
  });
}

export function useDeleteMeasurable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteMeasurable(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_SCORECARD_KEY });
    },
  });
}

export function useReorderMeasurables() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; display_order: number }[]) => {
      const result = await reorderMeasurables(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_SCORECARD_KEY });
    },
  });
}

export function useUpsertScorecardEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      measurableId: string;
      weekOf: string;
      value: number | null;
    }) => {
      const result = await upsertScorecardEntry(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_SCORECARD_KEY });
    },
  });
}

export function useAutoPopulateScorecardWeek() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, weekOf }: { teamId: string; weekOf: string }) => {
      const result = await autoPopulateScorecardWeek(teamId, weekOf);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_SCORECARD_KEY });
    },
  });
}

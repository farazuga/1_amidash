import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  getUsers,
} from '@/app/(dashboard)/l10/actions';

// Query keys
export const L10_TEAMS_KEY = ['l10', 'teams'];
export const L10_TEAM_KEY = ['l10', 'team'];
export const USERS_KEY = ['users'];

const THIRTY_SECONDS = 30 * 1000;

// ============================================
// Query hooks
// ============================================

export function useTeams() {
  return useQuery({
    queryKey: L10_TEAMS_KEY,
    queryFn: async () => {
      const result = await getTeams();
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
  });
}

export function useTeam(teamId: string | null) {
  return useQuery({
    queryKey: [...L10_TEAM_KEY, teamId],
    queryFn: async () => {
      if (!teamId) return null;
      const result = await getTeam(teamId);
      if (!result.success) throw new Error(result.error);
      return result.data || null;
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!teamId,
  });
}

export function useAllUsers() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: async () => {
      const result = await getUsers();
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
  });
}

// ============================================
// Mutation hooks
// ============================================

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const result = await createTeam(data);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_TEAMS_KEY });
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; name?: string; description?: string | null }) => {
      const result = await updateTeam(data);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: L10_TEAMS_KEY });
      queryClient.invalidateQueries({ queryKey: [...L10_TEAM_KEY, data.id] });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => {
      const result = await deleteTeam(teamId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_TEAMS_KEY });
    },
  });
}

export function useAddTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { teamId: string; userId: string; role?: string }) => {
      const result = await addTeamMember(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...L10_TEAM_KEY, variables.teamId] });
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { teamId: string; userId: string }) => {
      const result = await removeTeamMember(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...L10_TEAM_KEY, variables.teamId] });
    },
  });
}

export function useUpdateTeamMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { teamId: string; userId: string; role: string }) => {
      const result = await updateTeamMemberRole(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...L10_TEAM_KEY, variables.teamId] });
    },
  });
}
